import TopBar from '@/components/ui/TopBar';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import Toast from '@/components/ui/Toast';
import DeferredPricingCalculator from '@/components/marketing/DeferredPricingCalculator';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <TopBar />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <DeferredPricingCalculator />
      <Toast />
    </div>
  );
}
