/**
 * Global Search Component
 * 
 * Search across quotes, invoices, customers, and products
 */

import { useState, useEffect, useRef } from "react";
import { Search, FileText, Receipt, User, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";

interface SearchResult {
  id: string;
  type: "quote" | "invoice" | "customer" | "product";
  title: string;
  subtitle: string;
  url: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  // Mock search function - replace with actual API call
  const performSearch = (searchQuery: string): SearchResult[] => {
    if (!searchQuery.trim()) return [];

    const mockResults: SearchResult[] = [
      {
        id: "1",
        type: "quote",
        title: "Quote #1001",
        subtitle: "ABC Corporation - $2,245.00",
        url: "/quotes/1",
      },
      {
        id: "2",
        type: "invoice",
        title: "Invoice #5001",
        subtitle: "XYZ Industries - $1,120.00",
        url: "/invoices/1",
      },
      {
        id: "3",
        type: "customer",
        title: "John Smith",
        subtitle: "Smith & Co - john@smithco.com",
        url: "/customers/1",
      },
      {
        id: "4",
        type: "product",
        title: "Gildan 5000",
        subtitle: "Heavy Cotton T-Shirt - $3.50",
        url: "/products/1",
      },
    ];

    return mockResults.filter(
      (result) =>
        result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (query) {
        const searchResults = performSearch(query);
        setResults(searchResults);
        setIsOpen(searchResults.length > 0);
        setSelectedIndex(0);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [query]);

  // Close search when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen || results.length === 0) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
          break;
        case "Enter":
          event.preventDefault();
          if (results[selectedIndex]) {
            navigateToResult(results[selectedIndex]);
          }
          break;
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const navigateToResult = (result: SearchResult) => {
    setLocation(result.url);
    setIsOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "quote":
        return <FileText className="h-4 w-4" />;
      case "invoice":
        return <Receipt className="h-4 w-4" />;
      case "customer":
        return <User className="h-4 w-4" />;
      case "product":
        return <Package className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: SearchResult["type"]) => {
    switch (type) {
      case "quote":
        return "text-blue-500";
      case "invoice":
        return "text-green-500";
      case "customer":
        return "text-purple-500";
      case "product":
        return "text-orange-500";
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          placeholder="Search quotes, invoices, customers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className="pl-10"
        />
      </div>

      {isOpen && results.length > 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            {results.map((result, index) => (
              <button
                key={result.id}
                onClick={() => navigateToResult(result)}
                className={`w-full flex items-start gap-3 p-3 rounded-md text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className={`mt-0.5 ${getTypeColor(result.type)}`}>
                  {getIcon(result.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{result.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.subtitle}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {result.type}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {isOpen && results.length === 0 && query && (
        <Card className="absolute top-full mt-2 w-full z-50 p-4 text-center text-sm text-muted-foreground">
          No results found for "{query}"
        </Card>
      )}
    </div>
  );
}

