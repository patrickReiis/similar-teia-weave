import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { LoginModal } from "@/components/LoginModal";

interface LayoutProps {
  children: ReactNode;
  showLoginModal?: boolean;
  setShowLoginModal?: (show: boolean) => void;
}

export function Layout({ children, showLoginModal: propShowLoginModal, setShowLoginModal: propSetShowLoginModal }: LayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [localShowLoginModal, setLocalShowLoginModal] = useState(false);
  
  // Use props if provided, otherwise use local state
  const showLoginModal = propShowLoginModal !== undefined ? propShowLoginModal : localShowLoginModal;
  const setShowLoginModal = propSetShowLoginModal || setLocalShowLoginModal;
  
  const handleLoginClick = () => {
    setShowLoginModal(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-similarteia-light">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-2xl font-semibold text-similarteia-dark">
              SimilarTeia
            </Link>
          </div>
          
          <nav className="flex items-center space-x-4">
            <Link 
              to="/" 
              className="text-similarteia-dark hover:text-similarteia-accent transition-colors"
            >
              Home
            </Link>
            
            <Link 
              to="/explore" 
              className="text-similarteia-dark hover:text-similarteia-accent transition-colors"
            >
              Explore
            </Link>
            
            {isAuthenticated && (
              <Link 
                to="/create" 
                className="text-similarteia-dark hover:text-similarteia-accent transition-colors"
              >
                Create
              </Link>
            )}
            
            {isLoading ? (
              <Button disabled variant="outline">
                Loading...
              </Button>
            ) : isAuthenticated ? (
              <UserProfileMenu />
            ) : (
              <Button 
                onClick={handleLoginClick}
                className="bg-similarteia-accent hover:bg-similarteia-accent/90 text-white"
              >
                Login
              </Button>
            )}
          </nav>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto py-8 px-4 md:px-0">
        {children}
      </main>
      
      <footer className="border-t py-6 bg-white">
        <div className="container mx-auto text-center text-sm text-similarteia-muted">
          <p>SimilarTeia &copy; {new Date().getFullYear()} - A book similarity platform powered by Nostr</p>
        </div>
      </footer>
      
      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </div>
  );
}