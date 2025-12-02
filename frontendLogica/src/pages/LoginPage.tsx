
import LoginForm from "@/components/auth/LoginForm";
import { Link } from "react-router-dom";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";

const LoginPage = () => {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-4 text-center">
        <Link to="/">
          <img 
            src={logoDark}
            alt="optimizalo.app" 
            className="h-8 sm:h-10 mx-auto mb-2 dark:hidden"
          />
          <img 
            src={logoLight}
            alt="optimizalo.app" 
            className="h-8 sm:h-10 mx-auto mb-2 hidden dark:block"
          />
        </Link>
      </div>
      
      <LoginForm />
    </div>
  );
};

export default LoginPage;