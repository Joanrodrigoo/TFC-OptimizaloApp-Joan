import { useState } from "react";
import EmailRegistrationForm from "@/components/auth/EmailRegistrationForm";
import CustomCompleteRegistrationForm from "@/components/auth/CustomCompleteRegistrationForm";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import OnboardingGuide from "@/components/onboarding/OnboardingGuide";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";

const RegisterPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [registrationComplete, setRegistrationComplete] = useState(false);
  
  // Only show CompleteRegistrationForm when both token and email are present
  const hasToken = Boolean(token) && Boolean(email);

  const handleRegistrationComplete = () => {
    setRegistrationComplete(true);
  };

  const handleSkipOnboarding = () => {
    navigate("/dashboard");
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {registrationComplete ? (
        <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <Link to="/">
              <img 
                src={logoDark}
                alt="optimizalo.app" 
                className="h-12 mx-auto mb-6 dark:hidden"
              />
              <img 
                src={logoLight}
                alt="optimizalo.app" 
                className="h-12 mx-auto mb-6 hidden dark:block"
              />
            </Link>
            <p className="text-muted-foreground">Conecta tu cuenta de Google Ads</p>
          </div>
          <OnboardingGuide onSkip={handleSkipOnboarding} />
        </div>
      ) : hasToken ? (
        <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <Link to="/">
              <img 
                src={logoDark}
                alt="optimizalo.app" 
                className="h-12 mx-auto mb-6 dark:hidden"
              />
              <img 
                src={logoLight}
                alt="optimizalo.app" 
                className="h-12 mx-auto mb-6 hidden dark:block"
              />
            </Link>
            <p className="text-muted-foreground">Completa tu registro</p>
          </div>
          <CustomCompleteRegistrationForm onRegistrationComplete={handleRegistrationComplete} />
        </div>
      ) : (
        <EmailRegistrationForm />
      )}
    </div>
  );
};

export default RegisterPage;