import { Component, OnInit } from '@angular/core';
import { Address, Orders, Product, UserDocument } from '../product';
import { MatTableDataSource } from '@angular/material/table';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { OrderService } from '../services/orders.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { FirebaseService } from '../services/firebase.service';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import jsPDF from 'jspdf';
import { UserDataService } from '../services/user-data.service';
import { FormGroup } from '@angular/forms';
import { saveAs } from 'file-saver';

const getObservable = (collection: AngularFirestoreCollection<Product>) => {
  const subject = new BehaviorSubject<Product[]>([]);
  collection.valueChanges({ idField: 'id' }).subscribe((val: Product[]) => {
    subject.next(val);
  });
  return subject;
};

@Component({
  selector: 'app-user-orders',
  templateUrl: './user-orders.component.html',
  styleUrls: ['./user-orders.component.css'],
})
export class UserOrdersComponent implements OnInit {
  cartItems: Product[] = [];
  dataSource = new MatTableDataSource<Product>([]);
  acceptedOrders$: Observable<Orders[]>;
  currentUser: UserDocument | null = null;
  addresses: Address[] = [];
  userForm: FormGroup | null = null;
  isDataLoaded = false;
  product = getObservable(this.store.collection('product')) as Observable<Product[]>;
  constructor(
    private ordersService: OrderService,
    private afAuth: AngularFireAuth,
    private store: AngularFirestore,
    private userDataService: UserDataService,
    private firebaseService: FirebaseService
  ) {}
  orderPlacedDate: Date | null = null;
  activeButton: string = '';
  ngOnInit() {
    this.afAuth.authState.subscribe((user) => {
      if (user) {
        this.firebaseService.getUserById(user.uid).subscribe(
          (userData) => {
            this.userDataService.setCurrentUser(userData);
            this.fetchAddresses(userData.userId);
            this.currentUser = userData as UserDocument;
            this.fetchAcceptedOrders();
            this.fetchDeclinedOrders();
            this.fetchOrdersInProgress();
          },
          (error) => {
            console.error('Error fetching user data:', error);
            this.isDataLoaded = true;
          }
        );
      }
    });
    this.userDataService.userForm$.subscribe((userForm) => {
      if (userForm !== null) {
        this.userForm = userForm;
      }
    });
  }
  
  fetchOrdersInProgress() {
    const userId = this.currentUser?.userId;
    if (userId) {
      this.ordersService.getOrdersInProgressForUser(userId).subscribe((userOrdersInProgress) => {
        this.acceptedOrders$ = of(userOrdersInProgress);
        if (userOrdersInProgress.length > 0) {
          const order = userOrdersInProgress[0];
          if (order.orderPlacedAt instanceof Date) {
            this.orderPlacedDate = order.orderPlacedAt;
          } else {
            this.orderPlacedDate = order.orderPlacedAt;
          }
        }
      });
    }
    this.activeButton = '';
  }
  
  fetchAcceptedOrders() {
    const userId = this.currentUser?.userId;
    if (userId) {
      this.ordersService.getAcceptedOrdersByUser(userId).subscribe((userAcceptedOrders) => {
        this.acceptedOrders$ = of(userAcceptedOrders);
        if (userAcceptedOrders.length > 0) {
          const order = userAcceptedOrders[0];
          if (order.orderPlacedAt instanceof Date) {
            this.orderPlacedDate = order.orderPlacedAt;
          } else {
            this.orderPlacedDate = order.orderPlacedAt;
          }
        }
      });
      this.activeButton = 'acceptedOrders';
    }
  }
  
  fetchDeclinedOrders() {
    const userId = this.currentUser?.userId;
    if (userId) {
      this.ordersService.getDeclinedOrdersByUser(userId).subscribe((userDeclinedOrders) => {
        this.acceptedOrders$ = of(userDeclinedOrders);
        if (userDeclinedOrders.length > 0) {
          const order = userDeclinedOrders[0];
          if (order.orderPlacedAt instanceof Date) {
            this.orderPlacedDate = order.orderPlacedAt;
          } else {
            this.orderPlacedDate = order.orderPlacedAt;
          }
        }
      });
      this.activeButton = 'declinedOrders';
    }
  }
  
  fetchAddresses(userId: string) {
    this.firebaseService.getAddressById(userId).subscribe((addresses) => {
      this.userDataService.setAddresses(addresses);
      this.addresses = addresses;
      this.isDataLoaded = true;
    });
  }

  generatePDF() {
    const pdf = new jsPDF();
    const header = () => {
      pdf.addImage('/assets/title.png', 'PNG', 10, 10, 180, 40);
      pdf.setFontSize(10);
      pdf.text('User Details', 10, 65);
      pdf.text('Orders', 10, 125);
    };

    const footer = () => {
      const iconSize = 5;
      const spacing = 15;
      const pageWidth = pdf.internal.pageSize.width;
      const barHeight = 10;
      const totalWidth = 4 * iconSize + 3 * spacing;
      const startX1 = (pageWidth - totalWidth) / 2;
      const startX2 = startX1 + iconSize + spacing;
      const startX3 = startX2 + iconSize + spacing;
      const startX4 = startX3 + iconSize + spacing;
      const startY = pdf.internal.pageSize.height - barHeight;
      pdf.setFillColor(70, 185, 255);
      pdf.rect(0, startY, pageWidth, barHeight, 'F');
      pdf.link(startX1, startY, iconSize, iconSize, {
        url: 'https://www.facebook.com/',
      });
      pdf.addImage(
        'assets/facebook-icon.png',
        'PNG',
        startX1,
        startY,
        iconSize,
        iconSize
      );

      pdf.link(startX2, startY, iconSize, iconSize, {
        url: 'https://twitter.com/',
      });

      pdf.addImage(
        'assets/twitter-icon.png',
        'PNG',
        startX2,
        startY,
        iconSize,
        iconSize
      );

      pdf.link(startX3, startY, iconSize, iconSize, {
        url: 'https://www.youtube.com/',
      });

      pdf.addImage(
        'assets/youtube-icon.png',
        'PNG',
        startX3,
        startY,
        iconSize,
        iconSize
      );

      pdf.link(startX4, startY, iconSize, iconSize, {
        url: 'https://www.instagram.com/',
      });
      
      pdf.addImage(
        'assets/instagram-icon.png',
        'PNG',
        startX4,
        startY,
        iconSize,
        iconSize
      );
    };

    const ordersData = [];

    this.acceptedOrders$.subscribe((orders) => {
      orders.forEach((order, index) => {
        const orderDetails = [
          `${index + 1}`,
          `${order.status}`,
          `${order.totalAmount}`,
        ];

        order.items.forEach((item, itemIndex) => {
          const productDetails = [
            `Product ${itemIndex + 1}`,
            `${item.name}`,
            `${item.price}`,
          ];

          ordersData.push([...orderDetails, ...productDetails]);
        });
      });

      (pdf as any).autoTable({
        head: [['User', 'Details']],
        body: [
          ['Name', this.userForm.value.name],
          ['Email', this.userForm.value.email],
          ['Mobile', this.userForm.value.mobile],
          [
            'Address',
            `${
              this.addresses[0].house +
              ', ' +
              this.addresses[0].area +
              ', ' +
              this.addresses[0].landmark +
              ', ' +
              this.addresses[0].city +
              ', ' +
              this.addresses[0].state +
              ', ' +
              this.addresses[0].country +
              ' - ' +
              this.addresses[0].pincode
            }`,
          ],
        ],
        columnStyles: {
          0: { textSize: 14, textColor: [0, 0, 0] },
        },
        startY: 70,
        didDrawPage: header,
      });

      (pdf as any).autoTable({
        head: [
          ['Order', 'Status', 'Total Amount in Rs', 'Product', 'Name', 'Price'],
        ],
        body: ordersData,
        startY: (pdf as any).autoTable.previous.finalY + 20,
        didDrawPage: footer,
      });
    });
    return pdf.output('datauristring').split(',')[1];
  }

  downloadPdf() {
    const pdfBase64 = this.generatePDF();
    const pdfBlob = this.base64toBlob(pdfBase64, 'application/pdf');
    saveAs(pdfBlob, 'user-details-and-orders.pdf');
  }

  openPDF() {
    const pdfBase64 = this.generatePDF();
    const pdfBlob = this.base64toBlob(pdfBase64, 'application/pdf');
    const pdfDataUri = URL.createObjectURL(pdfBlob);
    window.open(pdfDataUri, '_blank');
    URL.revokeObjectURL(pdfDataUri);
  }
  private base64toBlob(base64: string, mimeType: string): Blob {
    const byteString = atob(base64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const int8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      int8Array[i] = byteString.charCodeAt(i);
    }
    return new Blob([arrayBuffer], { type: mimeType });
  }
}