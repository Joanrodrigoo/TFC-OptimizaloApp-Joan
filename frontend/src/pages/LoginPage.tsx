
import LoginForm from "@/components/auth/LoginForm";

const LoginPage = () => {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gradient mb-2">AdOps AI</h1>
        <p className="text-muted-foreground">Sign in to your account</p>
      </div>
      
      <LoginForm />
    </div>
  );
};

export default LoginPage;
