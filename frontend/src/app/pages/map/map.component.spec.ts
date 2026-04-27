import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';

describe('MapComponent', () => {
  let fixture: ComponentFixture<MapComponent>;
  let component: MapComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent, HttpClientTestingModule],
    }).compileComponents();
    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    component.isMobile = false;
    fixture.detectChanges();
  });

  it('emits addDisplay when FAB is clicked', () => {
    component.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'USER' } as any;
    fixture.detectChanges();
    let emitted = false;
    component.addDisplay.subscribe(() => emitted = true);
    const fab = fixture.debugElement.query(By.css('[data-testid="add-display-fab"]'));
    expect(fab).toBeTruthy();
    fab.nativeElement.click();
    expect(emitted).toBeTrue();
  });

  it('hides FAB when user is null', () => {
    component.user = null;
    fixture.detectChanges();
    const fab = fixture.debugElement.query(By.css('[data-testid="add-display-fab"]'));
    expect(fab).toBeNull();
  });

  it('shows FAB in mobile layout when user is set', () => {
    component.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'USER' } as any;
    component.isMobile = true;
    fixture.detectChanges();
    const fab = fixture.debugElement.query(By.css('[data-testid="add-display-fab"]'));
    expect(fab).toBeTruthy();
  });
});
