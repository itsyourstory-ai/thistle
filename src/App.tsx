import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { WizardProvider } from "@/contexts/WizardContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import ProtectedRoute from "@/components/ProtectedRoute";
import RootRedirect from "@/components/RootRedirect";
import { WIZARD_STEPS } from "@/lib/wizardSteps";
import Step1Name from "./pages/steps/Step1Name";
import Step2Buyer from "./pages/steps/Step2Buyer";
import Step3Genre from "./pages/steps/Step3Genre";
import Step4Lesson from "./pages/steps/Step4Lesson";
import Step5Interests from "./pages/steps/Step5Interests";
import Step6ArtStyle from "./pages/steps/Step6ArtStyle";
import Step7Character from "./pages/steps/Step7Character";
import Step8Summary from "./pages/steps/Step8Summary";
import Step9Cast from "./pages/steps/Step9Cast";
import Step9Generating from "./pages/steps/Step9Generating";
import Step10Preview from "./pages/steps/Step10Preview";
import StepSecretIngredient from "./pages/steps/StepSecretIngredient";
import StepPlaceholder from "./pages/steps/StepPlaceholder";
import WizardLayout from "./pages/WizardLayout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import DevStoryPreview from "./pages/DevStoryPreview";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            {/* Wizard steps — WizardLayout stays mounted across step navigation for draft persistence */}
            <Route element={<ProtectedRoute><WizardLayout /></ProtectedRoute>}>
              <Route path="/step/1-name" element={<Step1Name />} />
              <Route path="/step/2-buyer" element={<Step2Buyer />} />
              <Route path="/step/3-genre" element={<Step3Genre />} />
              <Route path="/step/4-lesson" element={<Step4Lesson />} />
              <Route path="/step/5-interests" element={<Step5Interests />} />
              <Route path="/step/6-art-style" element={<Step6ArtStyle />} />
              <Route path="/step/7-character" element={<Step7Character />} />
              <Route path="/step/8-story" element={<Step8Summary />} />
              <Route path="/step/9-cast" element={<Step9Cast />} />
              <Route path="/step/10-preview" element={<Step10Preview />} />
              <Route path="/step/11-generating" element={<Step9Generating />} />
              {/* Secret Ingredient hidden — route preserved */}
              <Route path="/step/secret-ingredient" element={<StepSecretIngredient />} />
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
            {/* Dev-only full-book engine preview — auth required. */}
            <Route path="/dev/story-preview/:id" element={<ProtectedRoute><DevStoryPreview /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </WizardProvider>
        </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
