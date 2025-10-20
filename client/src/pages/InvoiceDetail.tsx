import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { PaymentForm } from "@/components/PaymentForm";
import { StatusBadge } from "@/components/StatusBadge";
import { ActivityLog } from "@/components/ActivityLog";

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: invoice, isLoading } = trpc.invoices.get.useQuery({ id: id! });
  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: lineItemGroups = [] } = trpc.lineItemGroups.listByInvoice.useQuery({ invoiceId: id! });
  const { data: payments = [] } = trpc.payments.getByInvoice.useQuery({ invoiceId: id! });

  const updateInvoice = trpc.invoices.update.useMutation({
    onSuccess: () => {
      utils.invoices.get.invalidate({ id: id! });
      utils.invoices.list.invalidate();
      toast.success("Invoice updated");
    },
  });

  // createLineItem mutation removed - invoices now use line item groups from quotes
  // const createLineItem = trpc.lineItems.create.useMutation({
  //   onSuccess: () => {
  //     utils.lineItemGroups.listByInvoice.invalidate({ invoiceId: id! });
  //     setShowAddLineItem(false);
  //     toast.success("Line item added");
  //   },
  // });

  const deleteLineItem = trpc.lineItems.delete.useMutation({
    onSuccess: () => {
      utils.lineItemGroups.listByInvoice.invalidate({ invoiceId: id! });
      toast.success("Line item removed");
    },
  });

  const createPayment = trpc.payments.create.useMutation({
    onSuccess: () => {
      utils.payments.getByInvoice.invalidate({ invoiceId: id! });
      utils.invoices.get.invalidate({ id: id! });
      setShowRecordPayment(false);
      toast.success("Payment recorded");
    },
  });

  const [showAddLineItem, setShowAddLineItem] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    customerId: "",
    status: "",
    productionDueDate: "",
    customerDueDate: "",
    paymentDueDate: "",
    poNumber: "",
    terms: "",
    deliveryMethod: "",
    notes: "",
  });

  // Line item form
  const [lineItemForm, setLineItemForm] = useState({
    productId: "",
    description: "",
    quantity: "1",
    unitPrice: "0",
    color: "",
    itemNumber: "",
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    notes: "",
  });

  if (isLoading || !invoice) {
    return (
      <DashboardLayout>
        <div className="p-6">Loading...</div>
      </DashboardLayout>
    );
  }

  const customer = customers.find((c) => c.id === invoice.customerId);

  // Initialize form data when entering edit mode
  const handleEditMode = () => {
    setFormData({
      customerId: invoice.customerId,
      status: invoice.status,
      productionDueDate: invoice.productionDueDate
        ? new Date(invoice.productionDueDate).toISOString().split("T")[0]
        : "",
      customerDueDate: invoice.customerDueDate
        ? new Date(invoice.customerDueDate).toISOString().split("T")[0]
        : "",
      paymentDueDate: invoice.paymentDueDate
        ? new Date(invoice.paymentDueDate).toISOString().split("T")[0]
        : "",
      poNumber: invoice.poNumber || "",
      terms: invoice.terms || "",
      deliveryMethod: invoice.deliveryMethod || "",
      notes: invoice.notes || "",
    });
    setEditMode(true);
  };

  const handleSave = () => {
    updateInvoice.mutate({
      id: invoice.id,
      ...formData,
      status: formData.status as any,
      productionDueDate: formData.productionDueDate
        ? new Date(formData.productionDueDate)
        : undefined,
      customerDueDate: formData.customerDueDate
        ? new Date(formData.customerDueDate)
        : undefined,
      paymentDueDate: formData.paymentDueDate
        ? new Date(formData.paymentDueDate)
        : undefined,
    });
    setEditMode(false);
  };

  // handleAddLineItem function removed - invoices now use line item groups from quotes
  // const handleAddLineItem = () => {
  //   const selectedProduct = products.find((p) => p.id === lineItemForm.productId);
  //   createLineItem.mutate({
  //     invoiceId: invoice.id,
  //     description: lineItemForm.description || selectedProduct?.name || "",
  //     quantity: parseInt(lineItemForm.quantity),
  //     unitPrice: lineItemForm.unitPrice,
  //     color: lineItemForm.color || undefined,
  //     itemNumber: lineItemForm.itemNumber || undefined,
  //   });
  // };

  const handleRecordPayment = () => {
    createPayment.mutate({
      invoiceId: invoice.id,
      amount: paymentForm.amount,
      paymentMethod: paymentForm.method,
      notes: paymentForm.notes || undefined,
    });
  };

  // Calculate total from all line item groups
  // Calculate total including products AND imprints
  const totalAmount = lineItemGroups.reduce((groupSum, group: any) => {
    // Calculate product costs
    const productTotal = (group.lineItems || []).reduce((itemSum: number, item: any) => {
      const qty = (
        (item.size2T || 0) + (item.size3T || 0) + (item.size4T || 0) + (item.size5T || 0) +
        (item.sizeYXS || 0) + (item.sizeYS || 0) + (item.sizeYM || 0) + (item.sizeYL || 0) + (item.sizeYXL || 0) +
        (item.sizeXS || 0) + (item.sizeS || 0) + (item.sizeM || 0) + (item.sizeL || 0) + (item.sizeXL || 0) +
        (item.size2XL || 0) + (item.size3XL || 0) + (item.size4XL || 0) + (item.size5XL || 0) + (item.size6XL || 0) +
        (item.sizeOther || 0)
      );
      return itemSum + (qty * parseFloat(item.unitPrice || '0'));
    }, 0);
    
    // Calculate total quantity for this group (for imprint costs)
    const totalQty = (group.lineItems || []).reduce((sum: number, item: any) => {
      const qty = (
        (item.size2T || 0) + (item.size3T || 0) + (item.size4T || 0) + (item.size5T || 0) +
        (item.sizeYXS || 0) + (item.sizeYS || 0) + (item.sizeYM || 0) + (item.sizeYL || 0) + (item.sizeYXL || 0) +
        (item.sizeXS || 0) + (item.sizeS || 0) + (item.sizeM || 0) + (item.sizeL || 0) + (item.sizeXL || 0) +
        (item.size2XL || 0) + (item.size3XL || 0) + (item.size4XL || 0) + (item.size5XL || 0) + (item.size6XL || 0) +
        (item.sizeOther || 0)
      );
      return sum + qty;
    }, 0);
    
    // Calculate imprint costs (setup fees + per-item costs)
    const imprintTotal = (group.imprints || []).reduce((imprintSum: number, imprint: any) => {
      const setupFee = parseFloat(imprint.setupFee || '0');
      const perItemCost = parseFloat(imprint.unitPrice || '0') * totalQty;
      return imprintSum + setupFee + perItemCost;
    }, 0);
    
    return groupSum + productTotal + imprintTotal;
  }, 0);

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
  const balance = totalAmount - totalPaid;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/invoices")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Invoice #{invoice.invoiceNumber}</h1>
              {customer && (
                <p className="text-muted-foreground">
                  {customer.name} • {customer.company}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <StatusBadge status={invoice.status} type="invoice" />
                {balance > 0 && (
                  <PaymentForm
                    invoiceId={invoice.id}
                    invoiceNumber={invoice.invoiceNumber}
                    balanceDue={balance}
                    onSuccess={() => {
                      utils.invoices.get.invalidate({ id: invoice.id });
                      utils.payments.getByInvoice.invalidate({ invoiceId: invoice.id });
                    }}
                  />
                )}
                <Button variant="outline" onClick={handleEditMode}>
                  Edit Invoice
                </Button>
                <Button variant="outline">Print PDF</Button>
              </>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalAmount.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${totalPaid.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  balance > 0 ? "text-orange-600" : "text-green-600"
                }`}
              >
                ${balance.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium">{invoice.status}</div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Details */}
        {editMode ? (
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select
                    value={formData.customerId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, customerId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} - {c.company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_production">In Production</SelectItem>
                      <SelectItem value="ready_to_print">Ready to Print</SelectItem>
                      <SelectItem value="ready_to_sew">Ready to Sew</SelectItem>
                      <SelectItem value="production_finished">Production Finished</SelectItem>
                      <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Production Due Date</Label>
                  <Input
                    type="date"
                    value={formData.productionDueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, productionDueDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer Due Date</Label>
                  <Input
                    type="date"
                    value={formData.customerDueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, customerDueDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Due Date</Label>
                  <Input
                    type="date"
                    value={formData.paymentDueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentDueDate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>PO Number</Label>
                  <Input
                    value={formData.poNumber}
                    onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Terms</Label>
                  <Input
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Delivery Method</Label>
                  <Input
                    value={formData.deliveryMethod}
                    onChange={(e) =>
                      setFormData({ ...formData, deliveryMethod: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Production Due</p>
                  <p className="font-medium">
                    {invoice.productionDueDate
                      ? new Date(invoice.productionDueDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer Due</p>
                  <p className="font-medium">
                    {invoice.customerDueDate
                      ? new Date(invoice.customerDueDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PO Number</p>
                  <p className="font-medium">{invoice.poNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Terms</p>
                  <p className="font-medium">{invoice.terms || "—"}</p>
                </div>
              </div>
              {invoice.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              {/* Add Item button removed - invoices now use line item groups from quotes */}
            </div>
          </CardHeader>
          <CardContent>
            {lineItemGroups.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No line items</p>
            ) : (
              <div className="space-y-6">
                {lineItemGroups.map((group: any) => (
                  <div key={group.id} className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">{group.name}</h3>
                    
                    {/* Products Table */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Products (Garments)</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-2">Item #</th>
                              <th className="text-left p-2">Color</th>
                              <th className="text-left p-2">Description</th>
                              <th className="text-left p-2">Sizes</th>
                              <th className="text-right p-2">Qty</th>
                              <th className="text-right p-2">Unit Price</th>
                              <th className="text-right p-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.lineItems?.map((item: any) => {
                              const sizes = [
                                item.size2T && `2T:${item.size2T}`,
                                item.size3T && `3T:${item.size3T}`,
                                item.size4T && `4T:${item.size4T}`,
                                item.size5T && `5T:${item.size5T}`,
                                item.sizeYXS && `YXS:${item.sizeYXS}`,
                                item.sizeYS && `YS:${item.sizeYS}`,
                                item.sizeYM && `YM:${item.sizeYM}`,
                                item.sizeYL && `YL:${item.sizeYL}`,
                                item.sizeYXL && `YXL:${item.sizeYXL}`,
                                item.sizeXS && `XS:${item.sizeXS}`,
                                item.sizeS && `S:${item.sizeS}`,
                                item.sizeM && `M:${item.sizeM}`,
                                item.sizeL && `L:${item.sizeL}`,
                                item.sizeXL && `XL:${item.sizeXL}`,
                                item.size2XL && `2XL:${item.size2XL}`,
                                item.size3XL && `3XL:${item.size3XL}`,
                                item.size4XL && `4XL:${item.size4XL}`,
                                item.size5XL && `5XL:${item.size5XL}`,
                                item.size6XL && `6XL:${item.size6XL}`,
                                item.sizeOther && `Other:${item.sizeOther}`,
                              ].filter(Boolean).join(', ');
                              
                              const totalQty = (
                                (item.size2T || 0) + (item.size3T || 0) + (item.size4T || 0) + (item.size5T || 0) +
                                (item.sizeYXS || 0) + (item.sizeYS || 0) + (item.sizeYM || 0) + (item.sizeYL || 0) + (item.sizeYXL || 0) +
                                (item.sizeXS || 0) + (item.sizeS || 0) + (item.sizeM || 0) + (item.sizeL || 0) + (item.sizeXL || 0) +
                                (item.size2XL || 0) + (item.size3XL || 0) + (item.size4XL || 0) + (item.size5XL || 0) + (item.size6XL || 0) +
                                (item.sizeOther || 0)
                              );
                              
                              return (
                                <tr key={item.id} className="border-t">
                                  <td className="p-2">{item.itemNumber}</td>
                                  <td className="p-2">{item.color}</td>
                                  <td className="p-2">{item.description}</td>
                                  <td className="p-2 text-sm">{sizes}</td>
                                  <td className="p-2 text-right">{totalQty}</td>
                                  <td className="p-2 text-right">${parseFloat(item.unitPrice || '0').toFixed(2)}</td>
                                  <td className="p-2 text-right">${(totalQty * parseFloat(item.unitPrice || '0')).toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Imprints Table */}
                    {group.imprints && group.imprints.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Imprints (Applied to ALL products above)</h4>
                        <p className="text-xs text-muted-foreground mb-2">Each imprint adds setup fees + per-item costs to every product in this group</p>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-muted">
                              <tr>
                                <th className="text-left p-2">Location</th>
                                <th className="text-left p-2">Method</th>
                                <th className="text-center p-2">Colors</th>
                                <th className="text-right p-2">Setup Fee</th>
                                <th className="text-right p-2">Per Item</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.imprints.map((imprint: any) => (
                                <tr key={imprint.id} className="border-t">
                                  <td className="p-2">{imprint.location}</td>
                                  <td className="p-2">{imprint.decorationMethod || imprint.method}</td>
                                  <td className="p-2 text-center">{imprint.colors}</td>
                                  <td className="p-2 text-right">${parseFloat(imprint.setupFee || '0').toFixed(2)}</td>
                                  <td className="p-2 text-right">${parseFloat(imprint.unitPrice || '0').toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payments</CardTitle>
              <Button onClick={() => setShowRecordPayment(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No payments recorded</p>
            ) : (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">${parseFloat(payment.amount || "0").toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {payment.paymentMethod} •{" "}
                        {payment.paymentDate
                          ? new Date(payment.paymentDate).toLocaleDateString()
                          : "—"}
                      </p>
                      {payment.notes && (
                        <p className="text-sm text-muted-foreground">{payment.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Line Item Dialog */}
        <Dialog open={showAddLineItem} onOpenChange={setShowAddLineItem}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Line Item</DialogTitle>
              <DialogDescription>Add a product or service to this invoice</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Product (Optional)</Label>
                <Select
                  value={lineItemForm.productId}
                  onValueChange={(value) => {
                    const product = products.find((p) => p.id === value);
                    setLineItemForm({
                      ...lineItemForm,
                      productId: value,
                      description: product?.name || "",
                      unitPrice: product?.basePrice || "0",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} - ${p.basePrice}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={lineItemForm.description}
                  onChange={(e) =>
                    setLineItemForm({ ...lineItemForm, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={lineItemForm.quantity}
                    onChange={(e) =>
                      setLineItemForm({ ...lineItemForm, quantity: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={lineItemForm.unitPrice}
                    onChange={(e) =>
                      setLineItemForm({ ...lineItemForm, unitPrice: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Color (Optional)</Label>
                  <Input
                    value={lineItemForm.color}
                    onChange={(e) =>
                      setLineItemForm({ ...lineItemForm, color: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Item # (Optional)</Label>
                  <Input
                    value={lineItemForm.itemNumber}
                    onChange={(e) =>
                      setLineItemForm({ ...lineItemForm, itemNumber: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddLineItem(false)}>
                Cancel
              </Button>
              {/* <Button onClick={handleAddLineItem}>Add Item</Button> */}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Record Payment Dialog */}
        <Dialog open={showRecordPayment} onOpenChange={setShowRecordPayment}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>Record a payment received for this invoice</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={paymentForm.method}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="ach">ACH/Bank Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRecordPayment(false)}>
                Cancel
              </Button>
              <Button onClick={handleRecordPayment}>Record Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

        {/* Activity Log */}
        <ActivityLog entityType="invoice" entityId={invoice.id} />
    </DashboardLayout>
  );
}

