import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Mail, Phone, Building2, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";

export default function CustomerDetail() {
  const [, params] = useRoute("/customers/:id");
  const [, setLocation] = useLocation();
  const customerId = params?.id || "";

  const { data: customer, isLoading } = trpc.customers.get.useQuery({ id: customerId });
  const { data: quotes = [] } = trpc.quotes.getByCustomer.useQuery({ customerId });
  const { data: invoices = [] } = trpc.invoices.getByCustomer.useQuery({ customerId });

  const utils = trpc.useUtils();
  const updateCustomer = trpc.customers.update.useMutation({
    onSuccess: () => {
      utils.customers.get.invalidate({ id: customerId });
      toast.success("Customer updated");
    },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
    creditLimit: "",
  });

  if (isLoading || !customer) {
    return (
      <DashboardLayout>
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    );
  }

  if (isEditing && formData.name === "") {
    setFormData({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      company: customer.company || "",
      notes: customer.notes || "",
      creditLimit: customer.creditLimit?.toString() || "0",
    });
  }

  // Calculate credit metrics
  const creditLimit = parseFloat(customer.creditLimit || '0') || 0;
  const creditUsed = outstandingBalance;
  const creditAvailable = creditLimit - creditUsed;
  const creditUsagePercent = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

  const handleSave = () => {
    updateCustomer.mutate({ id: customerId, ...formData });
    setIsEditing(false);
  };

  const totalQuotes = quotes.length;
  const totalInvoices = invoices.length;
  const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);
  const outstandingBalance = invoices
    .filter((inv) => inv.status !== "paid")
    .reduce((sum, inv) => sum + (parseFloat(inv.totalAmount || "0") - parseFloat(inv.paidAmount || "0")), 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/customers")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              <p className="text-sm text-muted-foreground">{customer.company}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save Changes</Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Edit Customer</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Quotes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalQuotes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalInvoices}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">${totalRevenue.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">${outstandingBalance.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Credit Limit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${creditLimit.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Maximum credit allowed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Credit Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${creditAvailable < 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${creditAvailable.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {creditAvailable < 0 ? 'Over limit!' : 'Remaining credit'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Credit Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{creditUsagePercent.toFixed(0)}%</div>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    creditUsagePercent > 100 ? 'bg-red-600' :
                    creditUsagePercent > 80 ? 'bg-orange-600' :
                    'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(creditUsagePercent, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Company</Label>
                    <Input
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Credit Limit</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.phone || "No phone"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.company || "No company"}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={6}
                />
              ) : (
                <p className="text-sm">{customer.notes || "No notes"}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            {quotes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No quotes</p>
            ) : (
              <div className="space-y-2">
                {quotes.slice(0, 5).map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => setLocation(`/quotes/${quote.id}`)}
                  >
                    <div>
                      <p className="font-medium">Quote #{quote.quoteNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(quote.createdAt || "").toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={quote.status} type="quote" />
                      <span className="font-bold">${parseFloat(quote.totalAmount || "0").toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No orders</p>
            ) : (
              <div className="space-y-2">
                {invoices.slice(0, 5).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => setLocation(`/invoices/${invoice.id}`)}
                  >
                    <div>
                      <p className="font-medium">Invoice #{invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.createdAt || "").toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={invoice.status} type="invoice" />
                      <span className="font-bold">${parseFloat(invoice.totalAmount || "0").toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
