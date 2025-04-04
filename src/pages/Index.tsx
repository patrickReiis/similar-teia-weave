import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";

const Index = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  const handleLoginClick = () => {
    setShowLoginModal(true);
  };

  return (
    <Layout showLoginModal={showLoginModal} setShowLoginModal={setShowLoginModal}>
      <div className="max-w-4xl mx-auto text-center py-8">
        <h1 className="text-4xl font-bold mb-6 text-similarteia-dark">
          Discover Book Connections
        </h1>
        
        <p className="text-xl text-similarteia-muted mb-8">
          SimilarTeia helps you find unexpected connections between books
          with a decentralized platform powered by Nostr.
        </p>
        
        <div className="flex flex-col md:flex-row gap-4 justify-center mb-12">
          {!isAuthenticated && (
            <Button 
              onClick={handleLoginClick} 
              disabled={isLoading}
              size="lg"
              className="bg-similarteia-accent hover:bg-similarteia-accent/90 text-white"
            >
              {isLoading ? "Loading..." : "Login with Nostr"}
            </Button>
          )}
          
          <Button asChild size="lg" variant="outline">
            <Link to="/explore">
              Explore Similarities
            </Link>
          </Button>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 text-left mb-12">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-2 text-similarteia-dark">Discover Connections</h2>
            <p className="text-similarteia-muted">
              Explore similarity relationships between books created by other users.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-2 text-similarteia-dark">Create Similarities</h2>
            <p className="text-similarteia-muted">
              Connect books with "event similarity" ratings and explain the relationship.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-2 text-similarteia-dark">Decentralized</h2>
            <p className="text-similarteia-muted">
              Built on Nostr, giving you control of your data and connections.
            </p>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-semibold mb-4 text-similarteia-dark">How It Works</h2>
          
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div>
              <div className="bg-similarteia-accent/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <span className="text-similarteia-accent font-bold text-xl">1</span>
              </div>
              <h3 className="text-lg font-medium mb-2 text-similarteia-dark">Login with Nostr</h3>
              <p className="text-similarteia-muted">
                Connect with your preferred Nostr login method.
              </p>
            </div>
            
            <div>
              <div className="bg-similarteia-accent/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <span className="text-similarteia-accent font-bold text-xl">2</span>
              </div>
              <h3 className="text-lg font-medium mb-2 text-similarteia-dark">Find Books</h3>
              <p className="text-similarteia-muted">
                Search for books using the OpenLibrary database.
              </p>
            </div>
            
            <div>
              <div className="bg-similarteia-accent/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <span className="text-similarteia-accent font-bold text-xl">3</span>
              </div>
              <h3 className="text-lg font-medium mb-2 text-similarteia-dark">Create Connections</h3>
              <p className="text-similarteia-muted">
                Rate similarity between books and explain the connection.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;