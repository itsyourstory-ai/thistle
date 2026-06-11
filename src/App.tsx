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
import Login from "./pages/Login";
import DevStoryPreview from "./pages/DevStoryPreview";
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
            {/* Dashboard placeholder — full implementation in Phase 4 */}
            <Route path="/dashboard" element={<ProtectedRoute><div style={{ padding: 40 }}>Dashboard coming soon</div></ProtectedRoute>} />
            <Route path="/step/1-name" element={<ProtectedRoute><Step1Name /></ProtectedRoute>} />
            <Route path="/step/2-buyer" element={<ProtectedRoute><Step2Buyer /></ProtectedRoute>} />
            <Route path="/step/3-genre" element={<ProtectedRoute><Step3Genre /></ProtectedRoute>} />
            <Route path="/step/4-lesson" element={<ProtectedRoute><Step4Lesson /></ProtectedRoute>} />
            <Route path="/step/5-interests" element={<ProtectedRoute><Step5Interests /></ProtectedRoute>} />
            <Route path="/step/6-art-style" element={<ProtectedRoute><Step6ArtStyle /></ProtectedRoute>} />
            <Route path="/step/7-character" element={<ProtectedRoute><Step7Character /></ProtectedRoute>} />
            <Route path="/step/8-story" element={<ProtectedRoute><Step8Summary /></ProtectedRoute>} />
            <Route path="/step/9-cast" element={<ProtectedRoute><Step9Cast /></ProtectedRoute>} />
            <Route path="/step/10-preview" element={<ProtectedRoute><Step10Preview /></ProtectedRoute>} />
            <Route path="/step/11-generating" element={<ProtectedRoute><Step9Generating /></ProtectedRoute>} />
            {/* Secret Ingredient hidden — route preserved */}
            <Route path="/step/secret-ingredient" element={<ProtectedRoute><StepSecretIngredient /></ProtectedRoute>} />
            {/* Legacy numeric redirects */}
            {WIZARD_STEPS.map((s) => (
              <Route
                key={s.num}
                path={`/step/${s.num}`}
                element={<Navigate to={s.path} replace />}
              />
            ))}
            <Route path="/step/:step" element={<ProtectedRoute><StepPlaceholder /></ProtectedRoute>} />
            {/* Dev-only full-book engine preview — no auth, unlinked. */}
            <Route path="/dev/story-preview/:id" element={<DevStoryPreview />} />
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
