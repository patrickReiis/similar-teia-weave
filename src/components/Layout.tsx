
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useNostr } from "@/contexts/NostrContext";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated, login, logout, isLoading } = useNostr();

  return (
    <div className="min-h-screen flex flex-col bg-similarteia-light">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center py-4">
          <Link to="/" className="text-2xl font-semibold text-similarteia-dark">
            SimilarTeia
          </Link>
          
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
              <Button 
                onClick={logout} 
                variant="outline"
                className="border-similarteia-accent text-similarteia-accent hover:bg-similarteia-accent hover:text-white"
              >
                Logout
              </Button>
            ) : (
              <Button 
                onClick={login}
                className="bg-similarteia-accent hover:bg-similarteia-accent/90 text-white"
              >
                Login with Nostr
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
    </div>
  );
}
