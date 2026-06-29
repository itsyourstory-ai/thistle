import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { WizardProvider } from "@/contexts/WizardContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingScreen from "@/components/LoadingScreen";
import OfflineBanner from "@/components/OfflineBanner";
import ProtectedRoute from "@/components/ProtectedRoute";
import RootRedirect from "@/components/RootRedirect";
import Login from "./pages/Login";
import WizardLayout from "./pages/WizardLayout";
import { WIZARD_STEPS } from "@/lib/wizardSteps";

const Step1Name = lazy(() => import("./pages/steps/Step1Name"));
const Step2Buyer = lazy(() => import("./pages/steps/Step2Buyer"));
const Step3Genre = lazy(() => import("./pages/steps/Step3Genre"));
const Step4Lesson = lazy(() => import("./pages/steps/Step4Lesson"));
const Step5Interests = lazy(() => import("./pages/steps/Step5Interests"));
const Step6ArtStyle = lazy(() => import("./pages/steps/Step6ArtStyle"));
const Step7Character = lazy(() => import("./pages/steps/Step7Character"));
const Step8Dedication = lazy(() => import("./pages/steps/Step8Dedication"));
const Step8Summary = lazy(() => import("./pages/steps/Step8Summary"));
const Step9Cast = lazy(() => import("./pages/steps/Step9Cast"));
const Step9Generating = lazy(() => import("./pages/steps/Step9Generating"));
const Step10Preview = lazy(() => import("./pages/steps/Step10Preview"));
const StepSecretIngredient = lazy(() => import("./pages/steps/StepSecretIngredient"));
const StepPlaceholder = lazy(() => import("./pages/steps/StepPlaceholder"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ResumeDraft = lazy(() => import("./pages/ResumeDraft"));
const Account = lazy(() => import("./pages/Account"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const DevStoryPreview = import.meta.env.DEV
  ? lazy(() => import("./pages/DevStoryPreview"))
  : null;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineBanner />
      <BrowserRouter>
        <ErrorBoundary>
        <AuthProvider>
        <WizardProvider>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/resume/:draftId" element={<ProtectedRoute><ResumeDraft /></ProtectedRoute>} />
              {/* Wizard steps — WizardLayout stays mounted across step navigation for draft persistence */}
              <Route element={<ProtectedRoute><WizardLayout /></ProtectedRoute>}>
                <Route path="/step/1-name" element={<Step1Name />} />
                <Route path="/step/2-buyer" element={<Step2Buyer />} />
                <Route path="/step/3-genre" element={<Step3Genre />} />
                <Route path="/step/4-lesson" element={<Step4Lesson />} />
                <Route path="/step/5-interests" element={<Step5Interests />} />
                <Route path="/step/6-art-style" element={<Step6ArtStyle />} />
                <Route path="/step/7-character" element={<Step7Character />} />
                <Route path="/step/8-dedication" element={<Step8Dedication />} />
                <Route path="/step/9-story" element={<Step8Summary />} />
                <Route path="/step/10-cast" element={<Step9Cast />} />
                <Route path="/step/11-preview" element={<Step10Preview />} />
                <Route path="/step/12-generating" element={<Step9Generating />} />
                {/* Secret Ingredient hidden — route preserved */}
                <Route path="/step/secret-ingredient" element={<StepSecretIngredient />} />
                {/* Legacy slug redirects for steps that shifted when dedication was inserted */}
                <Route path="/step/8-story" element={<Navigate to="/step/9-story" replace />} />
                <Route path="/step/9-cast" element={<Navigate to="/step/10-cast" replace />} />
                <Route path="/step/10-preview" element={<Navigate to="/step/11-preview" replace />} />
                <Route path="/step/11-generating" element={<Navigate to="/step/12-generating" replace />} />
                {/* Legacy numeric redirects */}
                {WIZARD_STEPS.map((s) => (
                  <Route
                    key={s.num}
                    path={`/step/${s.num}`}
                    element={<Navigate to={s.path} replace />}
                  />
                ))}
                <Route path="/step/:step" element={<StepPlaceholder />} />
              </Route>
              {/* Dev-only full-book engine preview — excluded from prod bundle */}
              {DevStoryPreview && (
                <Route path="/dev/story-preview/:id" element={<ProtectedRoute><DevStoryPreview /></ProtectedRoute>} />
              )}
              <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </WizardProvider>
        </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
