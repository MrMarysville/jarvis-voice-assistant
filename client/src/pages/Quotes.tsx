import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, Search } from "lucide-react";
import { Link } from "wouter";
import { APP_TITLE } from "@/const";

export default function Quotes() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: quotes, isLoading } = trpc.quotes.list.useQuery();

  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount));
  };

  const filteredQuotes = quotes?.filter((quote) => {
    const query = searchQuery.toLowerCase();
    return quote.quoteNumber.toString().includes(query);
  });

  return (
    <>
      <title>{APP_TITLE} - Quotes</title>
      <meta name="description" content="Manage customer quotes and estimates for your print shop" />
      <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Quotes</h1>
            <p className="text-muted-foreground mt-1">Manage customer quotes and estimates</p>
          </div>
          <Link href="/quotes/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Quote
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search quotes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading quotes...</p>
              </div>
            ) : filteredQuotes && filteredQuotes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Quote #</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium">Total</th>
                      <th className="text-left py-3 px-4 font-medium">Created</th>
                      <th className="text-left py-3 px-4 font-medium">Due Date</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotes.map((quote) => (
                      <tr key={quote.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">#{quote.quoteNumber}</td>
                        <td className="py-3 px-4">
                          <Badge className={`status-${quote.status}`}>{quote.status}</Badge>
                        </td>
                        <td className="py-3 px-4">{formatCurrency(quote.totalAmount)}</td>
                        <td className="py-3 px-4">{formatDate(quote.createdAt)}</td>
                        <td className="py-3 px-4">{formatDate(quote.customerDueDate)}</td>
                        <td className="py-3 px-4 text-right">
                          <Link href={`/quotes/${quote.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No quotes found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
    </>
  );
}
