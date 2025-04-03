import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';

/**
 * Custom hook for managing WebSocket connections to Nostr relays
 * Handles connection, reconnection, and message handling in a centralized way
 */
export function useNostrWebSocket(url: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const maxReconnectAttempts = 3;
  const reconnectAttemptsRef = useRef(0);
  
  // Clean up function to handle socket closing and timeout clearing
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      socketRef.current.close();
    }
  }, []);
  
  // Connect function that can be called programmatically
  const connect = useCallback(() => {
    // Clean up existing connection first
    cleanup();
    
    try {
      console.log(`Connecting to relay: ${url}`);
      const ws = new WebSocket(url);
      socketRef.current = ws;
      
      ws.onopen = () => {
        console.log('Connected to relay:', url);
        setIsConnected(true);
        setSocket(ws);
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
      };
      
      ws.onclose = () => {
        console.log('Disconnected from relay');
        setIsConnected(false);
        setSocket(null);
        
        // Attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          console.log(`Connection closed. Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          // Exponential backoff for reconnection
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 10000);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          console.error('Max reconnection attempts reached');
          toast({
            title: "Connection Error",
            description: "Failed to maintain connection to Nostr relay after multiple attempts.",
            variant: "destructive",
          });
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // We don't need to do anything here as onclose will also be called
      };
      
      return ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to Nostr relay.",
        variant: "destructive",
      });
      return null;
    }
  }, [url, cleanup]);
  
  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    
    return () => {
      cleanup();
    };
  }, [url, connect, cleanup]);
  
  // Helper to safely send WebSocket messages
  const sendMessage = useCallback((message: any): boolean => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: socket is not open');
      return false;
    }
    
    try {
      socketRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, []);
  
  // Helper function to add event listeners
  const addEventListener = useCallback((type: string, listener: (event: any) => void): (() => void) => {
    if (!socketRef.current) {
      console.error('Cannot add listener: socket not initialized');
      return () => {};
    }
    
    socketRef.current.addEventListener(type, listener);
    return () => {
      if (socketRef.current) {
        socketRef.current.removeEventListener(type, listener);
      }
    };
  }, []);
  
  // Subscription helper
  const subscribe = useCallback(
    (subscriptionId: string, filter: object, onEvent: (event: any) => void): (() => void) => {
      // Only proceed if we have a connected socket
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        console.error('Cannot subscribe: socket is not open');
        return () => {};
      }
      
      const messageHandler = (message: MessageEvent) => {
        try {
          const data = JSON.parse(message.data);
          if (Array.isArray(data) && data.length >= 2 && data[0] === 'EVENT' && data[1] === subscriptionId) {
            onEvent(data[2]);
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      };
      
      socketRef.current.addEventListener('message', messageHandler);
      
      // Send subscription request
      sendMessage(['REQ', subscriptionId, filter]);
      
      // Return cleanup function
      return () => {
        if (socketRef.current) {
          // Send unsubscribe request
          sendMessage(['CLOSE', subscriptionId]);
          socketRef.current.removeEventListener('message', messageHandler);
        }
      };
    },
    [sendMessage]
  );
  
  return {
    socket: socketRef.current,
    isConnected,
    connect,
    sendMessage,
    addEventListener,
    subscribe,
  };
}