import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Customers from "./pages/Customers";
import Quotes from "./pages/Quotes";
import Invoices from "./pages/Invoices";
import QuoteDetail from "./pages/QuoteDetail";
import InvoiceDetail from "./pages/InvoiceDetail";
import CustomerDetail from "./pages/CustomerDetail";
import Products from "./pages/Products";
import Tasks from "./pages/Tasks";
import Calendar from "./pages/Calendar";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/customers"} component={Customers} />
      <Route path={"/quotes/:id"} component={QuoteDetail} />
      <Route path={"/quotes"} component={Quotes} />
      <Route path={"/invoices/:id"} component={InvoiceDetail} />
      <Route path={"/invoices"} component={Invoices} />
      <Route path={"/customers/:id"} component={CustomerDetail} />
      <Route path={"/products"} component={Products} />
      <Route path={"/tasks"} component={Tasks} />
      <Route path={"/calendar"} component={Calendar} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

