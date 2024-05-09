import { Component } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { Product, UserDocument } from '../../product';
import { WishlistService } from '../../services/wishlist.service';
import { FirebaseService } from '../../services/firebase.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/authenticate.service';
import { PaymentService } from '../../services/payment.service';
import { OrderService } from '../../services/orders.service';

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.css'],
})
export class ProductDetailsComponent {
  isAuthenticated: boolean;
  productId: string;
  currentUser: UserDocument | null = null;
  product: Product | undefined;
  isAddedToWishlist: boolean = false;
  selectedRating: number = 0;
  stars = [
    { id: 1, icon: 'star', class: 'star-gray star-hover star' },
    { id: 2, icon: 'star', class: 'star-gray star-hover star' },
    { id: 3, icon: 'star', class: 'star-gray star-hover star' },
    { id: 4, icon: 'star', class: 'star-gray star-hover star' },
    { id: 5, icon: 'star', class: 'star-gray star-hover star' },
  ];
  averageRating: number = 0;
  productMessage: string;
  zoomLevel = 1;
    constructor(
    private route: ActivatedRoute,
    private store: AngularFirestore,
    private wishlistService: WishlistService,
    private afAuth: AngularFireAuth,
    private firebaseService: FirebaseService,
    private cartService: CartService,
    private router: Router,
    private authService: AuthService,
    private paymentService: PaymentService,
    private orderService: OrderService
  ) {
    const storedWishlistStatus = localStorage.getItem('isAddedToWishlist');
    this.isAddedToWishlist = storedWishlistStatus
      ? JSON.parse(storedWishlistStatus)
      : false;
  }
  ngOnInit() {
    this.isAuthenticated = this.authService.isSignedIn;
    this.route.params.subscribe((params) => {
      this.productId = params['id'];
      this.getProductDetails();
    });
    this.afAuth.authState.subscribe((user) => {
      if (user) {
        this.firebaseService.getUserById(user.uid).subscribe((userData) => {
          this.currentUser = userData as UserDocument;
          this.loadWishlistState();
          this.loadSelectedRating();
          this.loadRatings();
        });
      }
    });
    if (this.currentUser) {
      this.wishlistService.isProductInWishlist(this.currentUser.userId, this.productId)
        .then((isInWishlist) => {
          this.isAddedToWishlist = isInWishlist;
        });
    }
  }

  loadSelectedRating(): void {
    const selectedRatingKey = `selectedRating_${this.currentUser.userId}_${this.productId}`;
    const storedSelectedRating = localStorage.getItem(selectedRatingKey);
    this.selectedRating = storedSelectedRating ? parseInt(storedSelectedRating, 10): 0;
    this.updateStars();
  }

  saveSelectedRating(): void {
    const selectedRatingKey = `selectedRating_${this.currentUser.userId}_${this.productId}`;
    localStorage.setItem(selectedRatingKey, this.selectedRating.toString());
  }

  loadRatings(): void {
    this.wishlistService.getRatingsForProduct(this.productId)
      .subscribe((userRatings) => {
        const totalRatings = userRatings.length;
        if (totalRatings > 0) {
          const sumOfRatings = userRatings.reduce(
            (acc, userRating) => acc + userRating.rating, 0);
          this.averageRating = sumOfRatings / totalRatings;
          this.updateStars();
        }
      });
  }

  updateStars(): void {
    this.stars.forEach((star) => {
      star.class = star.id <= this.averageRating ? 'star-gold star' : 'star-gray star';
    });
  }

  getProductDetails() {
    this.store.collection('product').doc(this.productId).valueChanges().subscribe((product: Product) => {
        this.product = product;
      });
  }

  selectStar(value): void {
    this.selectedRating = value;
    this.saveSelectedRating();
    this.stars.forEach((star) => {
      star.class = star.id <= this.selectedRating ? 'star-gold star' : 'star-gray star';
    });
    this.wishlistService.submitRating(
      this.currentUser.userId,
      this.productId,
      this.selectedRating
    );
  }

  addToWishlist(product: Product): void {
    this.isAddedToWishlist = !this.isAddedToWishlist;
    if (this.isAddedToWishlist) {
      this.wishlistService.addToWishlist(this.currentUser.userId, product);
    } else {
      this.wishlistService.removeFromWishlist(
        this.currentUser.userId,
        product.id
      );
    }
    this.saveWishlistState();
  }

  private loadWishlistState(): void {
    const wishlistStateKey = `wishlistState_${this.currentUser.userId}`;
    const wishlistState = JSON.parse(localStorage.getItem(wishlistStateKey)) || {};
    this.isAddedToWishlist = wishlistState[this.productId] || false;
  }

  private saveWishlistState(): void {
    const wishlistStateKey = `wishlistState_${this.currentUser.userId}`;
    const wishlistState = JSON.parse(localStorage.getItem(wishlistStateKey)) || {};
    wishlistState[this.productId] = this.isAddedToWishlist;
    localStorage.setItem(wishlistStateKey, JSON.stringify(wishlistState));
  }

  buyProduct() {
    if (!this.isAuthenticated) {
      this.router.navigate(['/auth']);
      return;
    }

    const productPrice = Number(this.product.price) || 0;
    const count = 1;
    const handler = (<any>window).StripeCheckout.configure({
      key: 'pk_test_51OUQ2YSBsRjMaYOe1phMU8RuXK3UsacqVQ9wdcdl8w53r3DXxHMkMZoFIqKH9lqiitvrqttRjfifDiBnXrc4C2eh00jlSA8Rl3',
      locale: 'auto',
      token: (token: any) => {
        if (token && token.error) {
          console.error('Stripe token creation error:', token.error);
          alert('Error occurred during payment: ' + token.error.message);
        } else {
          alert('Payment Success!!');
          this.paymentService.updateTotalAmount(productPrice);

          const order = {
            userId: this.currentUser.userId,
            id: this.productId,
            totalAmount: productPrice * count,
            status: 'In Progress',
            userName: this.currentUser.email || this.currentUser.name,
            items: [
              {
                ...this.product,
                count: count,
              },
            ],
            count: count,
            orderPlacedAt: new Date(),
          };

          this.orderService.placeOrder(order).subscribe(
            () => {
              console.log('order', order);

              alert('Your order is in Progress!');
              console.log('Order placed successfully!');
              this.router.navigate(['/user-orders']);
            },
            (error) => {
              console.error('Error placing order:', error);
            }
          );
        }
      },
      closed: (data: any) => {
        if (data && data.error) {
          console.error('Stripe Checkout closed with an error:', data.error);
          alert('Error occurred during payment. Please try again.');
        } else {
          console.log('Stripe Checkout closed without an error.');
        }
      },
    });

    handler.open({
      name: 'Demo Site',
      description: 'Product Purchase',
      amount: productPrice * 100 + 100.0,
    });
  }

  addToCart() {
    this.cartService.addToCart(this.product);
    this.productAddedtoCart();
  }

  productAddedtoCart() {
    this.productMessage = 'Product Added to Cart Successfully!';
    setTimeout(() => (this.productMessage = undefined), 3000);
  }
}