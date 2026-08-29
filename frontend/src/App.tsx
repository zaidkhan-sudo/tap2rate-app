import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import QrCodesPage from "@/pages/QrCodesPage";
import QrDetailPage from "@/pages/QrDetailPage";
import GenerateQrPage from "@/pages/GenerateQrPage";
import { AuthProvider, useAuth } from "@/lib/auth";

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-black">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-violet-500" />
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, initializing } = useAuth();

  if (initializing) return <Splash />;

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route
        path="/qrs"
        element={
          <Protected>
            <QrCodesPage />
          </Protected>
        }
      />
      <Route
        path="/generate"
        element={
          <Protected>
            <GenerateQrPage />
          </Protected>
        }
      />
      <Route
        path="/qrs/:qrId"
        element={
          <Protected>
            <QrDetailPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
