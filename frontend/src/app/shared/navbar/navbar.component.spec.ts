import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavbarComponent } from './navbar.component';
import { By } from '@angular/platform-browser';

const mockUser = { id: 1, name: 'Test User', email: 'test@test.com', role: 'USER' } as any;

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let component: NavbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    component.isMobile = false;
    fixture.detectChanges();
  });

  it('emits signOut when Sign out is clicked in avatar dropdown', () => {
    component.user = mockUser;
    fixture.detectChanges();
    component.showAccount = true;
    fixture.detectChanges();
    let emitted = false;
    component.signOut.subscribe(() => emitted = true);
    const btn = fixture.debugElement.query(By.css('[data-testid="sign-out-btn"]'));
    expect(btn).toBeTruthy();
    btn!.nativeElement.click();
    expect(emitted).toBeTrue();
  });

  it('emits navigate("profile") when My Account is clicked', () => {
    component.user = mockUser;
    fixture.detectChanges();
    component.showAccount = true;
    fixture.detectChanges();
    let navigatedTo = '';
    component.navigate.subscribe((s: string) => navigatedTo = s);
    const btn = fixture.debugElement.queryAll(By.css('button'))
      .find(b => b.nativeElement.textContent.trim() === 'My Account');
    expect(btn).toBeTruthy();
    btn!.nativeElement.click();
    expect(navigatedTo).toBe('profile');
  });

  it('emits navigate("hosts") from Explore dropdown', () => {
    component.user = mockUser;
    fixture.detectChanges();
    component.showExplore = true;
    fixture.detectChanges();
    let navigatedTo = '';
    component.navigate.subscribe((s: string) => navigatedTo = s);
    const btn = fixture.debugElement.queryAll(By.css('button'))
      .find(b => b.nativeElement.textContent.trim() === 'Organizers');
    expect(btn).toBeTruthy();
    btn!.nativeElement.click();
    expect(navigatedTo).toBe('hosts');
  });
});
