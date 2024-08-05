import { Component } from '@angular/core';
import { Firestore, collection, getDocs, query, where, doc, updateDoc, addDoc } from '@angular/fire/firestore';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-trasfer',
  templateUrl: './trasfer.page.html',
  styleUrls: ['./trasfer.page.scss'],
})
export class TrasferPage {
  amount: number = 0;
  accountNumber: string = '';
  addToContacts: boolean = true;
  fromAccount: any = null;

  accounts: Array<{ number: string, balance: number, selected: boolean }> = [];

  constructor(private firestore: Firestore, private alertController: AlertController) {
    this.loadAccounts();
  }

  async loadAccounts() {
    try {
      const usersRef = collection(this.firestore, 'Users');
      const q = query(usersRef);
      const querySnapshot = await getDocs(q);

      const accountsToUpdate: Array<{ number: string, balance: number, selected: boolean }> = [];

      querySnapshot.forEach(async doc => {
        const userData = doc.data();
        const cuentas = userData['Cuentas'] || [];

        for (let numeroCuenta of cuentas) {
          const countsBankRef = collection(this.firestore, 'CountsBank');
          const qCountsBank = query(countsBankRef, where('NumeroCuenta', '==', numeroCuenta));
          const querySnapshotCountsBank = await getDocs(qCountsBank);

          let balance = 0;
          if (!querySnapshotCountsBank.empty) {
            const accountData = querySnapshotCountsBank.docs[0].data();
            balance = accountData['Saldo'] || 0;
          }

          accountsToUpdate.push({
            number: numeroCuenta,
            balance: balance,
            selected: false
          });
        }
      });

      this.accounts = accountsToUpdate;

    } catch (error) {
      console.error('Error al cargar las cuentas:', error);
      this.presentAlert('Error al cargar las cuentas.');
    }
  }

  onCheckChange(selectedAccount: any) {
    // Desmarcar todos los otros checkboxes
    this.accounts.forEach(account => {
      if (account !== selectedAccount) {
        account.selected = false;
      }
    });

    // Actualizar la cuenta seleccionada
    this.fromAccount = selectedAccount.selected ? selectedAccount : null;
  }

  async validateAccount() {
    if (!this.accountNumber) {
      this.presentAlert('Ingrese un número de cuenta válido');
      return;
    }

    try {
      // Búsqueda en la colección CountsBank
      const countsBankRef = collection(this.firestore, 'CountsBank');
      const qCountsBank = query(countsBankRef, where('NumeroCuenta', '==', this.accountNumber));
      const querySnapshotCountsBank = await getDocs(qCountsBank);

      if (!querySnapshotCountsBank.empty) {
        const accountData = querySnapshotCountsBank.docs[0].data();
        const nombreTitular = accountData['NombreTitular'];
        this.presentAlert(`Titular de la cuenta: ${nombreTitular}`);
      } else {
        this.presentAlert('No se encontró la cuenta en CountsBank.');
        return;
      }

      // Búsqueda en la colección Contacts
      const contactsRef = collection(this.firestore, 'Contacts');
      const qContacts = query(contactsRef, where('NumeroCuenta', '==', this.accountNumber));
      const querySnapshotContacts = await getDocs(qContacts);

      if (!querySnapshotContacts.empty) {
        this.addToContacts = false; // Ocultar la opción si ya existe en contactos
      } else {
        this.addToContacts = true; // Mostrar la opción si no existe en contactos
      }

    } catch (error) {
      console.error('Error al validar la cuenta:', error);
      this.presentAlert('Error al validar la cuenta.');
    }
  }

  async transfer(amount: number, fromAccount: any) {
    if (amount <= 0) {
      this.presentAlert('La cantidad debe ser mayor que cero.');
      return;
    }

    if (!fromAccount) {
      this.presentAlert('Seleccione una cuenta de origen.');
      return;
    }

    try {
      // Buscar la cuenta seleccionada en CountsBank
      const countsBankRef = collection(this.firestore, 'CountsBank');
      const qCountsBankFrom = query(countsBankRef, where('NumeroCuenta', '==', fromAccount.number));
      const querySnapshotFrom = await getDocs(qCountsBankFrom);

      if (!querySnapshotFrom.empty) {
        const accountDocFrom = querySnapshotFrom.docs[0];
        const accountDataFrom = accountDocFrom.data();

        if (amount > accountDataFrom['Saldo']) {
          this.presentAlert('La cantidad excede el saldo disponible.');
          return;
        }

        // Restar la cantidad al saldo de la cuenta de origen
        const nuevoSaldoFrom = accountDataFrom['Saldo'] - amount;

        // Actualizar el saldo en la base de datos para la cuenta de origen
        await updateDoc(doc(this.firestore, 'CountsBank', accountDocFrom.id), { Saldo: nuevoSaldoFrom });

        // Actualizar el saldo en la interfaz para la cuenta de origen
        fromAccount.balance = nuevoSaldoFrom;
        this.accounts = [...this.accounts]; // Forzar la actualización de la vista

        // Buscar la cuenta de destino en CountsBank
        const qCountsBankTo = query(countsBankRef, where('NumeroCuenta', '==', this.accountNumber));
        const querySnapshotTo = await getDocs(qCountsBankTo);

        if (!querySnapshotTo.empty) {
          const accountDocTo = querySnapshotTo.docs[0];
          const accountDataTo = accountDocTo.data();

          // Sumar la cantidad al saldo de la cuenta de destino
          const nuevoSaldoTo = accountDataTo['Saldo'] + amount;

          // Actualizar el saldo en la base de datos para la cuenta de destino
          await updateDoc(doc(this.firestore, 'CountsBank', accountDocTo.id), { Saldo: nuevoSaldoTo });

          this.presentAlert(`Transferencia realizada exitosamente. Saldo actual de la cuenta de origen: ${nuevoSaldoFrom.toFixed(2)} y de la cuenta de destino: ${nuevoSaldoTo.toFixed(2)}`);
        } else {
          this.presentAlert('No se encontró la cuenta de destino en CountsBank.');
        }

        if (this.addToContacts) {
          // Copiar el documento a la colección Contacts
          const contactsRef = collection(this.firestore, 'Contacts');
          await addDoc(contactsRef, accountDataFrom);
          this.presentAlert('Contacto guardado exitosamente.');
        }
      } else {
        this.presentAlert('No se encontró la cuenta en CountsBank.');
      }
    } catch (error) {
      console.error('Error al realizar la transferencia:', error);
      this.presentAlert('Error al realizar la transferencia.');
    }
  }

  async presentAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Notificación',
      message: message,
      buttons: ['OK'],
    });

    await alert.present();
  }
}
