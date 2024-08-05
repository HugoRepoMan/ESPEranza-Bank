import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrasferPage } from './trasfer.page';

describe('TrasferPage', () => {
  let component: TrasferPage;
  let fixture: ComponentFixture<TrasferPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TrasferPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
