
import { useState } from "react";
import EmailRegistrationForm from "@/components/auth/EmailRegistrationForm";
import CustomCompleteRegistrationForm from "@/components/auth/CustomCompleteRegistrationForm";
import { useSearchParams, useNavigate } from "react-router-dom";
import OnboardingGuide from "@/components/onboarding/OnboardingGuide";

const RegisterPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [registrationComplete, setRegistrationComplete] = useState(false);
  
  // Debug logs to help troubleshoot
  console.log("Token:", token);
  console.log("Email:", email);
  console.log("Has both:", Boolean(token) && Boolean(email));
  
  // Only show CompleteRegistrationForm when both token and email are present
  const hasToken = Boolean(token) && Boolean(email);

  const handleRegistrationComplete = () => {
    setRegistrationComplete(true);
  };

  const handleSkipOnboarding = () => {
    navigate("/dashboard");
  };
  
  return (
    <div className="min-h-screen flex flex-col justify-center bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gradient mb-2">AdOps AI</h1>
        {!registrationComplete ? (
          <p className="text-muted-foreground">
            {hasToken ? "Completa tu registro" : "Crea tu cuenta"}
          </p>
        ) : (
          <p className="text-muted-foreground">
            Conecta tu cuenta de Google Ads
          </p>
        )}
      </div>
      
      {registrationComplete ? (
        <OnboardingGuide onSkip={handleSkipOnboarding} />
      ) : hasToken ? (
        <CustomCompleteRegistrationForm onRegistrationComplete={handleRegistrationComplete} />
      ) : (
        <EmailRegistrationForm />
      )}
    </div>
  );
};

export default RegisterPage;
