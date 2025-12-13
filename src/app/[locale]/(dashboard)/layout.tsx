import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UserDataProvider } from '@/contexts/UserDataContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <UserDataProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </UserDataProvider>
  );
}

