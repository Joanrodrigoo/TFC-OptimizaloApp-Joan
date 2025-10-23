import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const LandingPage = () => {

  const navigate = useNavigate();

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch("https://pwi.es/api/auth/status", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.loggedIn) {
            navigate("/dashboard");
          }
        }
      } catch (error) {
        console.error("Error verificando sesión:", error);
      }
    };

    checkLogin();
  }, [navigate]);


  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <h1 className="text-2xl font-bold text-gradient">AdOps AI</h1>
          <nav className="flex items-center gap-4">
            <Link 
              to="/login" 
              className="text-sm font-medium hover:text-adops-600 transition-colors"
            >
              Log in
            </Link>
            <Link to="/register">
              <Button className="bg-adops-600 hover:bg-adops-700">Sign up</Button>
            </Link>
          </nav>
        </div>
      </header>
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Optimize your Google Ads with 
              <span className="text-gradient"> AI-powered insights</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
              Connect your Google Ads accounts, get AI-powered recommendations, and improve your campaigns' performance with actionable insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="bg-adops-600 hover:bg-adops-700 px-8 py-6">
                  Get Started for Free
                </Button>
              </Link>
              <Link to="/demo">
                <Button size="lg" variant="outline" className="px-8 py-6">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section className="py-16 bg-muted/30 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold text-center mb-12">How AdOps AI Helps You</h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-background rounded-lg p-6 shadow-sm">
                <div className="h-12 w-12 rounded-full bg-adops-100 text-adops-600 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7h-9"></path>
                    <path d="M14 17H5"></path>
                    <circle cx="17" cy="17" r="3"></circle>
                    <circle cx="7" cy="7" r="3"></circle>
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Easy Google Ads Integration</h3>
                <p className="text-muted-foreground">
                  Connect your Google Ads accounts in seconds with our secure OAuth integration. No complex setup required.
                </p>
              </div>
              
              <div className="bg-background rounded-lg p-6 shadow-sm">
                <div className="h-12 w-12 rounded-full bg-adops-100 text-adops-600 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12h20"></path>
                    <path d="M12 2v20"></path>
                    <path d="m4.93 4.93 14.14 14.14"></path>
                    <path d="m19.07 4.93-14.14 14.14"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">AI-Powered Analysis</h3>
                <p className="text-muted-foreground">
                  Get actionable recommendations from our AI system that analyzes your campaign data and identifies improvement opportunities.
                </p>
              </div>
              
              <div className="bg-background rounded-lg p-6 shadow-sm">
                <div className="h-12 w-12 rounded-full bg-adops-100 text-adops-600 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 14 4-4"></path>
                    <path d="M3.34 19a10 10 0 1 1 17.32 0"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Performance Tracking</h3>
                <p className="text-muted-foreground">
                  Monitor your campaign metrics in real-time with beautiful dashboards and track improvements as you implement our recommendations.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-20 px-4 bg-adops-600 text-white">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to optimize your Google Ads campaigns?
            </h2>
            <p className="text-lg md:text-xl opacity-90 mb-10">
              Join thousands of marketers who are saving time and improving results with AdOps AI.
            </p>
            <Link to="/register">
              <Button size="lg" variant="secondary" className="px-8 py-6">
                Start Your Free Trial
              </Button>
            </Link>
          </div>
        </section>
      </main>
      
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h2 className="text-xl font-bold text-gradient">AdOps AI</h2>
              <p className="text-sm text-muted-foreground">
                © 2023 AdOps AI. All rights reserved.
              </p>
            </div>
            <nav className="flex gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Terms
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Contact
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
