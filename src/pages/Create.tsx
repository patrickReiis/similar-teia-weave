import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { BookSearch } from "@/components/BookSearch";
import { BookCard } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/use-toast";
import { Book, createSimilarityEvent } from "@/lib/nostr";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const Create = () => {
  const { isAuthenticated, canSign } = useAuth();
  const navigate = useNavigate();
  
  const [book1, setBook1] = useState<Book | null>(null);
  const [book2, setBook2] = useState<Book | null>(null);
  const [similarity, setSimilarity] = useState<number>(0.5);
  const [content, setContent] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Redirect if not authenticated
  if (!isAuthenticated) {
    toast({
      title: "Authentication Required",
      description: "Please login to create similarity events.",
      variant: "destructive",
    });
    navigate("/");
    return null;
  }

  // Show warning if user is in read-only mode
  const readOnlyAlert = !canSign && (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Read-Only Mode</AlertTitle>
      <AlertDescription>
        You are logged in with a public key (read-only mode). You cannot create similarity events.
        Please login with an extension or private key to create content.
      </AlertDescription>
    </Alert>
  );

  const handleSubmit = async () => {
    if (!canSign) {
      toast({
        title: "Cannot Create Event",
        description: "You are in read-only mode. Please login with an extension or private key.",
        variant: "destructive",
      });
      return;
    }

    if (!book1 || !book2) {
      toast({
        title: "Missing Books",
        description: "Please select two books to create a similarity.",
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: "Missing Description",
        description: "Please provide a description of the similarity between the books.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      await createSimilarityEvent(book1, book2, similarity, content);
      
      // Reset form
      setBook1(null);
      setBook2(null);
      setSimilarity(0.5);
      setContent("");
      
      // Navigate to explore
      navigate("/explore");
    } catch (error) {
      console.error("Failed to create similarity event:", error);
      toast({
        title: "Event Creation Failed",
        description: "Failed to create similarity event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-similarteia-dark">
          Create Book Similarity
        </h1>
        
        {readOnlyAlert}
        
        <p className="text-lg text-similarteia-muted mb-8">
          Connect two books by their similarity and explain the relationship between them.
        </p>
        
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4 text-similarteia-dark">Select First Book</h2>
          
          {book1 ? (
            <div className="mb-4">
              <BookCard 
                book={book1} 
                selected 
                onClick={() => setBook1(null)} 
              />
              <p className="text-sm text-muted-foreground mt-2">
                Click the book to remove it
              </p>
            </div>
          ) : (
            <BookSearch 
              onSelectBook={setBook1} 
              placeholder="Search for the first book..." 
            />
          )}
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4 text-similarteia-dark">Select Second Book</h2>
          
          {book2 ? (
            <div className="mb-4">
              <BookCard 
                book={book2} 
                selected 
                onClick={() => setBook2(null)} 
              />
              <p className="text-sm text-muted-foreground mt-2">
                Click the book to remove it
              </p>
            </div>
          ) : (
            <BookSearch 
              onSelectBook={setBook2} 
              placeholder="Search for the second book..." 
            />
          )}
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4 text-similarteia-dark">Set Similarity Level</h2>
          
          <div className="px-4">
            <Slider
              value={[similarity]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={(values) => setSimilarity(values[0])}
              className="my-6"
            />
            
            <div className="flex justify-between text-sm text-similarteia-muted">
              <span>0% - Not Similar</span>
              <span>{Math.round(similarity * 100)}%</span>
              <span>100% - Very Similar</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4 text-similarteia-dark">Describe the Similarity</h2>
          
          <Textarea
            placeholder="Explain why these books are similar or different..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-32"
          />
        </div>
        
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!book1 || !book2 || !content.trim() || isSubmitting || !canSign}
            className="bg-similarteia-accent hover:bg-similarteia-accent/90 text-white"
            size="lg"
          >
            {isSubmitting ? "Creating..." : "Create Similarity Event"}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default Create;