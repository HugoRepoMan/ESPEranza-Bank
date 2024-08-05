import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, query, where, addDoc, updateDoc, doc } from '@angular/fire/firestore';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  accounts: { number: string; saldo: number | null; checked: boolean }[] = [];
  selectedAccount: string | null = null;
  accountNumber: string = '';
  id: string = '';
  banco: string = '';
  tipoCuenta: string = '';
  nombreTitular: string = '';
  cantidad: string = '';
  agregarContacto: boolean = false;  // Para controlar el checkbox
  isEditable: boolean = true; // Para controlar la editabilidad de los campos
  showCheckbox: boolean = true; // Para controlar la visibilidad del checkbox

  constructor(
    private firestore: Firestore, 
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadAccounts();
  }

  async loadAccounts() {
    try {
      const accountsRef = collection(this.firestore, 'Users');
      const q = query(accountsRef, where("Cuentas", "!=", null));
      const querySnapshot = await getDocs(q);

      const accountNumbers = querySnapshot.docs
        .map(doc => doc.data()['Cuentas'])
        .reduce((acc, val) => acc.concat(val), []);

      this.accounts = await Promise.all(accountNumbers.map(async (number: string) => {
        const saldo = await this.getAccountSaldo(number);
        return { number, saldo, checked: false };
      }));
      console.log('Accounts with saldo:', this.accounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }

  async getAccountSaldo(number: string): Promise<number | null> {
    try {
      const saldoRef = collection(this.firestore, 'CountsBank');
      const q = query(saldoRef, where('NumeroCuenta', '==', number));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        if (data && typeof data['Saldo'] === 'number') {
          return data['Saldo'];
        } else {
          return 0;
        }
      } else {
        return 0;
      }
    } catch (error) {
      console.error('Error getting saldo for account number:', number, error);
      return 0;
    }
  }

  async validateAccount() {
    const accountNumber = this.accountNumber;
    if (!accountNumber) {
      this.presentAlert('Ingrese un número de cuenta válido');
      return;
    }

    try {
      const contactRef = collection(this.firestore, 'Contacts');
      const q = query(contactRef, where('NumeroCuenta', '==', accountNumber));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const contactData = querySnapshot.docs[0].data();
        this.id = contactData['ID'] || '';
        this.banco = contactData['Banco'] || '';
        this.tipoCuenta = contactData['TipoCuenta'] || '';
        this.nombreTitular = contactData['NombreTitular'] || '';

        // Desmarcar el checkbox, ocultarlo y deshabilitar la edición de los otros campos
        this.agregarContacto = false;
        this.isEditable = false;
        this.showCheckbox = false;
      } else {
        // Si no se encuentra el contacto, restaurar la configuración inicial
        this.resetFormState();
      }
    } catch (error) {
      console.error('Error validating account:', error);
      this.presentAlert('Error validando la cuenta.');
    }
  }

  resetFormState() {
    // Restablecer los valores a su estado inicial
    this.id = '';
    this.banco = '';
    this.tipoCuenta = '';
    this.nombreTitular = '';
    this.isEditable = true;
    this.showCheckbox = true;
    this.agregarContacto = true;
  }

  async transfer() {
    if (!this.accountNumber || !this.cantidad) {
      this.presentAlert('Todos los campos son obligatorios');
      return;
    }

    const transferAmount = parseFloat(this.cantidad);
    const additionalFee = 0.50;
    const totalDeduction = transferAmount + additionalFee;

    if (isNaN(transferAmount) || transferAmount <= 0) {
      this.presentAlert('Ingrese una cantidad válida mayor a 0');
      return;
    }

    try {
      const countsBankRef = collection(this.firestore, 'CountsBank');
      const selectedAccountDoc = await this.getAccountDocByNumber(this.selectedAccount);
      const targetAccountDoc = await this.getAccountDocByNumber(this.accountNumber);

      if (!selectedAccountDoc) {
        this.presentAlert('No se encontró la cuenta seleccionada.');
        return;
      }
      if (!targetAccountDoc) {
        this.presentAlert('No se encontró la cuenta destino.');
        return;
      }

      const selectedAccountData = selectedAccountDoc.data();
      const targetAccountData = targetAccountDoc.data();

      if (selectedAccountData['Saldo'] < totalDeduction) {
        this.presentAlert('Saldo insuficiente en la cuenta seleccionada.');
        return;
      }

      // Comparar valores ingresados con los valores de la base de datos
      if (
        targetAccountData['ID'] !== this.id ||
        targetAccountData['Banco'] !== this.banco ||
        targetAccountData['TipoCuenta'] !== this.tipoCuenta ||
        targetAccountData['NombreTitular'] !== this.nombreTitular
      ) {
        this.presentAlert('Error: Los datos ingresados no coinciden con los registros.');
        return; // Detener la operación si los datos no coinciden
      }

      // Validar que la cuenta no esté ya en el array `Cuentas` de `Users`
      const userAccountExists = await this.checkIfAccountExistsInUsers(this.accountNumber);
      if (userAccountExists) {
        this.presentAlert('Esta cuenta ya existe en los usuarios registrados. No se guardará como contacto.');
      }

      // Si todo es válido, realizar la transferencia
      const newSelectedAccountSaldo = selectedAccountData['Saldo'] - totalDeduction;
      const newTargetAccountSaldo = targetAccountData['Saldo'] + transferAmount;

      await updateDoc(selectedAccountDoc.ref, { Saldo: newSelectedAccountSaldo });
      await updateDoc(targetAccountDoc.ref, { Saldo: newTargetAccountSaldo });

      this.presentAlert('Transferencia exitosa. Se le ha restado $0.50 por cargos adicionales.');

      // Si la cuenta no existe en `Users` y la transferencia fue exitosa, guardar el contacto si corresponde
      if (this.agregarContacto && !userAccountExists) {
        await addDoc(collection(this.firestore, 'Contacts'), {
          NumeroCuenta: targetAccountData['NumeroCuenta'],
          Banco: targetAccountData['Banco'],
          TipoCuenta: targetAccountData['TipoCuenta'],
          ID: targetAccountData['ID'],
          NombreTitular: targetAccountData['NombreTitular'],
          Saldo: newTargetAccountSaldo
        });
        this.presentAlert('Contacto guardado exitosamente.');
      }

    } catch (error) {
      console.error('Error durante la transferencia:', error);
      this.presentAlert('Error durante la transferencia.');
    }
  }

  async getAccountDocByNumber(accountNumber: string | null) {
    if (!accountNumber) return null;

    const countsBankRef = collection(this.firestore, 'CountsBank');
    const q = query(countsBankRef, where('NumeroCuenta', '==', accountNumber));
    const querySnapshot = await getDocs(q);

    return querySnapshot.empty ? null : querySnapshot.docs[0];
  }

  async checkIfAccountExistsInUsers(accountNumber: string): Promise<boolean> {
    const usersRef = collection(this.firestore, 'Users');
    const q = query(usersRef, where('Cuentas', 'array-contains', accountNumber));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  }

  async presentAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Notificación',
      message: message,
      buttons: ['OK'],
      cssClass: 'custom-alert'
    });

    await alert.present();
  }

  onCheckChange(account: { number: string; saldo: number | null; checked: boolean }) {
    this.accounts.forEach(acc => {
      if (acc.number !== account.number) {
        acc.checked = false;
      }
    });
    account.checked = !account.checked;
    this.selectedAccount = account.checked ? account.number : null;
    console.log('Selected Account:', this.selectedAccount);
  }

  async loadSaldo(account: { number: string; saldo: number | null; checked: boolean }) {
    const saldo = await this.getAccountSaldo(account.number);
    account.saldo = saldo;
    this.accounts = [...this.accounts];
  }
}
