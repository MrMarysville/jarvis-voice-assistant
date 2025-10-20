import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { QuoteActions } from "@/components/QuoteActions";
import { StatusBadge } from "@/components/StatusBadge";
import { ActivityLog } from "@/components/ActivityLog";

// Types for building quote before creation
type NewLineItemGroup = {
  tempId: string;
  name: string;
  decorationMethod: string;
  products: NewProduct[];
  imprints: NewImprint[];
};

type NewProduct = {
  tempId: string;
  itemNumber: string;
  color: string;
  description: string;
  unitPrice: string;
  size2T: number;
  size3T: number;
  size4T: number;
  sizeXS: number;
  sizeS: number;
  sizeM: number;
  sizeL: number;
  sizeXL: number;
  size2XL: number;
  size3XL: number;
  size4XL: number;
  size5XL: number;
  size6XL: number;
};

type NewImprint = {
  tempId: string;
  location: string;
  method: string;
  colors: number;
  setupFee: number;
  perItemPrice: number;
};

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const isNewQuote = id === "new";
  const { data: quote, isLoading } = trpc.quotes.get.useQuery(
    { id: id! },
    { enabled: !isNewQuote && !!id }
  );
  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: customer } = trpc.customers.get.useQuery(
    { id: quote?.customerId! },
    { enabled: !!quote?.customerId && !isNewQuote }
  );
  const { data: groups = [] } = trpc.lineItemGroups.listByQuote.useQuery(
    { quoteId: id! },
    { enabled: !!id && !isNewQuote }
  );

  // New quote state
  const [newQuoteForm, setNewQuoteForm] = useState({
    customerId: "",
    productionDueDate: "",
    notes: "",
  });

  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });

  // Line item groups being built (before quote creation)
  const [newLineItemGroups, setNewLineItemGroups] = useState<NewLineItemGroup[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: "",
    decorationMethod: "Screen Print",
  });

  // Product/Imprint forms
  const [showProductForm, setShowProductForm] = useState<string | null>(null);
  const [showImprintForm, setShowImprintForm] = useState<string | null>(null);
  const [editingImprintId, setEditingImprintId] = useState<string | null>(null);

  const [productForm, setProductForm] = useState<NewProduct>({
    tempId: "",
    itemNumber: "",
    color: "",
    description: "",
    unitPrice: "",
    size2T: 0, size3T: 0, size4T: 0, sizeXS: 0, sizeS: 0, sizeM: 0,
    sizeL: 0, sizeXL: 0, size2XL: 0, size3XL: 0, size4XL: 0, size5XL: 0, size6XL: 0,
  });

  const [imprintForm, setImprintForm] = useState<NewImprint>({
    tempId: "",
    location: "",
    method: "Screen Print",
    colors: 1,
    setupFee: 0,
    perItemPrice: 0,
  });

  // Mutations for existing quote
  const createGroup = trpc.lineItemGroups.create.useMutation({
    onSuccess: () => {
      utils.lineItemGroups.listByQuote.invalidate({ quoteId: id! });
      setShowGroupForm(false);
      setGroupForm({ name: "", decorationMethod: "Screen Print" });
    },
  });

  const createProduct = trpc.lineItems.create.useMutation({
    onSuccess: () => {
      utils.lineItems.listByGroup.invalidate();
      setShowProductForm(null);
      resetProductForm();
    },
  });

  const createImprint = trpc.imprints.create.useMutation({
    onSuccess: () => {
      utils.imprints.listByGroup.invalidate();
      setShowImprintForm(null);
      resetImprintForm();
    },
  });

  const deleteProduct = trpc.lineItems.delete.useMutation({
    onSuccess: () => utils.lineItems.listByGroup.invalidate(),
  });

  const updateImprint = trpc.imprints.update.useMutation({
    onSuccess: () => {
      utils.imprints.listByGroup.invalidate();
      setShowImprintForm(null);
      setEditingImprintId(null);
      resetImprintForm();
    },
  });

  const deleteImprint = trpc.imprints.delete.useMutation({
    onSuccess: () => utils.imprints.listByGroup.invalidate(),
  });

  const convertToInvoice = trpc.quotes.convertToInvoice.useMutation({
    onSuccess: (data) => setLocation(`/invoices/${data.invoiceId}`),
    onError: (error) => {
      alert(`Failed to convert quote to invoice: ${error.message}`);
    },
  });

  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: (data) => {
      utils.customers.list.invalidate();
      setNewQuoteForm({ ...newQuoteForm, customerId: data.id });
      setShowNewCustomerForm(false);
      setNewCustomerForm({ name: "", email: "", phone: "", company: "" });
    },
    onError: (error) => {
      alert(`Failed to create customer: ${error.message}`);
    },
  });

  const createQuote = trpc.quotes.createWithLineItems.useMutation({
    onSuccess: (data) => {
      setLocation(`/quotes/${data.id}`);
    },
    onError: (error) => {
      alert(`Failed to create quote: ${error.message}`);
    },
  });

  // Helper functions
  const resetProductForm = () => {
    setProductForm({
      tempId: "",
      itemNumber: "",
      color: "",
      description: "",
      unitPrice: "",
      size2T: 0, size3T: 0, size4T: 0, sizeXS: 0, sizeS: 0, sizeM: 0,
      sizeL: 0, sizeXL: 0, size2XL: 0, size3XL: 0, size4XL: 0, size5XL: 0, size6XL: 0,
    });
  };

  const resetImprintForm = () => {
    setImprintForm({
      tempId: "",
      location: "",
      method: "Screen Print",
      colors: 1,
      setupFee: 0,
      perItemPrice: 0,
    });
  };

  const addLineItemGroup = () => {
    if (!groupForm.name.trim()) {
      alert("Group name is required");
      return;
    }
    const newGroup: NewLineItemGroup = {
      tempId: `temp_${Date.now()}`,
      name: groupForm.name,
      decorationMethod: groupForm.decorationMethod,
      products: [],
      imprints: [],
    };
    setNewLineItemGroups([...newLineItemGroups, newGroup]);
    setGroupForm({ name: "", decorationMethod: "Screen Print" });
    setShowGroupForm(false);
  };

  const addProductToGroup = (groupTempId: string) => {
    const totalQty = productForm.size2T + productForm.size3T + productForm.size4T +
      productForm.sizeXS + productForm.sizeS + productForm.sizeM + productForm.sizeL +
      productForm.sizeXL + productForm.size2XL + productForm.size3XL +
      productForm.size4XL + productForm.size5XL + productForm.size6XL;

    if (!productForm.itemNumber.trim()) {
      alert("Item Number is required");
      return;
    }
    if (!productForm.description.trim()) {
      alert("Description is required");
      return;
    }
    if (!productForm.unitPrice || parseFloat(productForm.unitPrice) <= 0) {
      alert("Unit Price must be greater than 0");
      return;
    }
    if (totalQty === 0) {
      alert("Please enter at least one size quantity");
      return;
    }

    const newProduct = { ...productForm, tempId: `temp_${Date.now()}` };
    setNewLineItemGroups(newLineItemGroups.map(g =>
      g.tempId === groupTempId
        ? { ...g, products: [...g.products, newProduct] }
        : g
    ));
    resetProductForm();
    setShowProductForm(null);
  };

  const addImprintToGroup = (groupTempId: string) => {
    if (!imprintForm.location.trim()) {
      alert("Imprint Location is required");
      return;
    }
    if (imprintForm.colors < 1) {
      alert("Number of colors must be at least 1");
      return;
    }

    const newImprint = { ...imprintForm, tempId: `temp_${Date.now()}` };
    setNewLineItemGroups(newLineItemGroups.map(g =>
      g.tempId === groupTempId
        ? { ...g, imprints: [...g.imprints, newImprint] }
        : g
    ));
    resetImprintForm();
    setShowImprintForm(null);
  };

  const removeProductFromGroup = (groupTempId: string, productTempId: string) => {
    setNewLineItemGroups(newLineItemGroups.map(g =>
      g.tempId === groupTempId
        ? { ...g, products: g.products.filter(p => p.tempId !== productTempId) }
        : g
    ));
  };

  const removeImprintFromGroup = (groupTempId: string, imprintTempId: string) => {
    setNewLineItemGroups(newLineItemGroups.map(g =>
      g.tempId === groupTempId
        ? { ...g, imprints: g.imprints.filter(i => i.tempId !== imprintTempId) }
        : g
    ));
  };

  const removeGroup = (groupTempId: string) => {
    setNewLineItemGroups(newLineItemGroups.filter(g => g.tempId !== groupTempId));
  };

  const calculateGroupTotal = (group: NewLineItemGroup) => {
    let total = 0;

    // Product totals
    group.products.forEach(product => {
      const qty = product.size2T + product.size3T + product.size4T +
        product.sizeXS + product.sizeS + product.sizeM + product.sizeL +
        product.sizeXL + product.size2XL + product.size3XL +
        product.size4XL + product.size5XL + product.size6XL;
      total += qty * parseFloat(product.unitPrice || "0");
    });

    // Imprint totals
    const totalQty = group.products.reduce((sum, product) => {
      return sum + product.size2T + product.size3T + product.size4T +
        product.sizeXS + product.sizeS + product.sizeM + product.sizeL +
        product.sizeXL + product.size2XL + product.size3XL +
        product.size4XL + product.size5XL + product.size6XL;
    }, 0);

    group.imprints.forEach(imprint => {
      total += imprint.setupFee + (imprint.perItemPrice * totalQty);
    });

    return total;
  };

  const calculateQuoteTotal = () => {
    return newLineItemGroups.reduce((sum, group) => sum + calculateGroupTotal(group), 0);
  };

  const handleCreateQuote = async () => {
    if (!newQuoteForm.customerId) {
      alert("Please select a customer");
      return;
    }
    if (newLineItemGroups.length === 0) {
      alert("Please add at least one line item group with products");
      return;
    }

    // Validate all groups have products
    for (const group of newLineItemGroups) {
      if (group.products.length === 0) {
        alert(`Group "${group.name}" has no products. Please add products or remove the group.`);
        return;
      }
    }

    createQuote.mutate({
      customerId: newQuoteForm.customerId,
      productionDueDate: newQuoteForm.productionDueDate ? new Date(newQuoteForm.productionDueDate) : undefined,
      notes: newQuoteForm.notes || undefined,
      lineItemGroups: newLineItemGroups.map((group, idx) => ({
        name: group.name,
        decorationMethod: group.decorationMethod,
        sortOrder: idx,
        products: group.products.map((product, pIdx) => ({
          ...product,
          sortOrder: pIdx,
        })),
        imprints: group.imprints.map((imprint, iIdx) => ({
          ...imprint,
          sortOrder: iIdx,
        })),
      })),
    });
  };

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!quote && !isNewQuote) {
    return (
      <DashboardLayout>
        <div>Quote not found</div>
      </DashboardLayout>
    );
  }

  // Handle new quote creation with full line item building
  if (isNewQuote) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Create New Quote</h1>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Estimated Total</div>
              <div className="text-3xl font-bold">${calculateQuoteTotal().toFixed(2)}</div>
            </div>
          </div>

          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Customer *</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                  >
                    {showNewCustomerForm ? "Select Existing" : "+ New Customer"}
                  </Button>
                </div>
                {showNewCustomerForm ? (
                  <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
                    <h4 className="font-semibold text-sm">Create New Customer</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Name *</Label>
                        <Input
                          placeholder="Customer name"
                          value={newCustomerForm.name}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Company</Label>
                        <Input
                          placeholder="Company name"
                          value={newCustomerForm.company}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, company: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Email</Label>
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          value={newCustomerForm.email}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Phone</Label>
                        <Input
                          placeholder="(555) 123-4567"
                          value={newCustomerForm.phone}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (!newCustomerForm.name.trim()) {
                            alert("Customer name is required");
                            return;
                          }
                          createCustomer.mutate(newCustomerForm);
                        }}
                        disabled={createCustomer.isPending}
                      >
                        {createCustomer.isPending ? "Creating..." : "Create & Select"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowNewCustomerForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <select
                    className="w-full p-2 border rounded"
                    value={newQuoteForm.customerId}
                    onChange={(e) => setNewQuoteForm({ ...newQuoteForm, customerId: e.target.value })}
                  >
                    <option value="">Select a customer...</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `- ${c.company}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Production Due Date</Label>
                  <Input
                    type="date"
                    value={newQuoteForm.productionDueDate}
                    onChange={(e) => setNewQuoteForm({ ...newQuoteForm, productionDueDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input
                    placeholder="Order notes..."
                    value={newQuoteForm.notes}
                    onChange={(e) => setNewQuoteForm({ ...newQuoteForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Item Groups */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button onClick={() => setShowGroupForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Line Item Group
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {showGroupForm && (
                <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                  <h3 className="font-semibold">Add Line Item Group</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Group Name *</Label>
                      <Input
                        placeholder="e.g., Screen Print - Front"
                        value={groupForm.name}
                        onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Decoration Method</Label>
                      <Input
                        value={groupForm.decorationMethod}
                        onChange={(e) => setGroupForm({ ...groupForm, decorationMethod: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addLineItemGroup}>Add Group</Button>
                    <Button variant="outline" onClick={() => setShowGroupForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {newLineItemGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No line item groups yet. Click "Add Line Item Group" to get started.</p>
                </div>
              ) : (
                newLineItemGroups.map((group) => (
                  <NewGroupSection
                    key={group.tempId}
                    group={group}
                    showProductForm={showProductForm}
                    setShowProductForm={setShowProductForm}
                    productForm={productForm}
                    setProductForm={setProductForm}
                    addProductToGroup={addProductToGroup}
                    removeProductFromGroup={removeProductFromGroup}
                    showImprintForm={showImprintForm}
                    setShowImprintForm={setShowImprintForm}
                    imprintForm={imprintForm}
                    setImprintForm={setImprintForm}
                    addImprintToGroup={addImprintToGroup}
                    removeImprintFromGroup={removeImprintFromGroup}
                    removeGroup={removeGroup}
                    calculateGroupTotal={calculateGroupTotal}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Create Quote Button */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setLocation("/quotes")}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateQuote}
              disabled={createQuote.isPending || !newQuoteForm.customerId || newLineItemGroups.length === 0}
              size="lg"
            >
              {createQuote.isPending ? "Creating..." : `Create Quote - $${calculateQuoteTotal().toFixed(2)}`}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Existing quote view (unchanged)
  const totalQuantity = Object.values(productForm).reduce((sum: number, val) => 
    typeof val === 'number' ? sum + val : sum, 0
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Quote #{quote?.quoteNumber}</h1>
            <p className="text-muted-foreground">
              {customer?.name} • {customer?.company}
            </p>
          </div>
          <div className="flex gap-2">
            <QuoteActions 
              quoteId={quote?.id || ""}
              currentStatus={quote?.status || "draft"}
              onSuccess={() => utils.quotes.get.invalidate({ id: quote?.id })}
            />
            <Button onClick={() => convertToInvoice.mutate({ id: quote?.id || '' })} disabled={!quote}>
              Convert to Invoice
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusBadge status={quote?.status || "draft"} type="quote" className="text-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(parseFloat(String(quote?.totalAmount || '0')) || 0).toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Production Due Date</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {quote?.productionDueDate
                  ? new Date(quote.productionDueDate).toLocaleDateString()
                  : "Not set"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Item Groups */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button onClick={() => setShowGroupForm(true)}>+ Add Line Item Group</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {showGroupForm && (
              <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                <h3 className="font-semibold">Add Line Item Group</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Group Name</Label>
                    <Input
                      placeholder="e.g., Screen Print - Front"
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Decoration Method</Label>
                    <Input
                      value={groupForm.decorationMethod}
                      onChange={(e) => setGroupForm({ ...groupForm, decorationMethod: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => createGroup.mutate({ ...groupForm, quoteId: id!, sortOrder: groups.length })}>
                    Add
                  </Button>
                  <Button variant="outline" onClick={() => setShowGroupForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {groups.map((group) => (
              <GroupSection
                key={group.id}
                group={group}
                showProductForm={showProductForm}
                setShowProductForm={setShowProductForm}
                productForm={productForm}
                setProductForm={setProductForm}
                createProduct={createProduct}
                deleteProduct={deleteProduct}
                showImprintForm={showImprintForm}
                setShowImprintForm={setShowImprintForm}
                imprintForm={imprintForm}
                setImprintForm={setImprintForm}
                createImprint={createImprint}
                updateImprint={updateImprint}
                deleteImprint={deleteImprint}
                editingImprintId={editingImprintId}
                setEditingImprintId={setEditingImprintId}
                totalQuantity={totalQuantity}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// Component for building new groups (before quote creation)
function NewGroupSection({ group, showProductForm, setShowProductForm, productForm, setProductForm, addProductToGroup, removeProductFromGroup, showImprintForm, setShowImprintForm, imprintForm, setImprintForm, addImprintToGroup, removeImprintFromGroup, removeGroup, calculateGroupTotal }: any) {
  const totalQuantity = productForm.size2T + productForm.size3T + productForm.size4T +
    productForm.sizeXS + productForm.sizeS + productForm.sizeM + productForm.sizeL +
    productForm.sizeXL + productForm.size2XL + productForm.size3XL +
    productForm.size4XL + productForm.size5XL + productForm.size6XL;

  return (
    <div className="border-2 border-primary/20 rounded-lg p-4 space-y-4 bg-primary/5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{group.name}</h3>
          <p className="text-sm text-muted-foreground">{group.decorationMethod}</p>
          <p className="text-sm font-semibold mt-1">Group Total: ${calculateGroupTotal(group).toFixed(2)}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowProductForm(group.tempId)}>
            + Add Product
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowImprintForm(group.tempId)}>
            + Add Imprint
          </Button>
          <Button size="sm" variant="destructive" onClick={() => removeGroup(group.tempId)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* PRODUCTS SECTION */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">Products (Garments)</h4>
        
        {showProductForm === group.tempId && (
          <div className="p-4 border rounded bg-muted/30 space-y-4">
            <h4 className="font-semibold">Add Product to Group</h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Item # *</Label>
                <Input placeholder="SKU" value={productForm.itemNumber} onChange={(e) => setProductForm({ ...productForm, itemNumber: e.target.value })} />
              </div>
              <div>
                <Label>Color</Label>
                <Input placeholder="Black, Navy, etc." value={productForm.color} onChange={(e) => setProductForm({ ...productForm, color: e.target.value })} />
              </div>
              <div>
                <Label>Description *</Label>
                <Input placeholder="Product description" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
              </div>
              <div>
                <Label>Unit Price *</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={productForm.unitPrice} onChange={(e) => setProductForm({ ...productForm, unitPrice: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Size Breakdown</Label>
              <div className="grid grid-cols-13 gap-2 mt-2">
                {['2T', '3T', '4T', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'].map((size) => {
                  const key = `size${size}` as keyof typeof productForm;
                  return (
                    <div key={size} className="space-y-1">
                      <Label className="text-xs">{size}</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        className="h-8"
                        value={productForm[key] || 0}
                        onChange={(e) => setProductForm({ ...productForm, [key]: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground mt-2">Total Quantity: {totalQuantity}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addProductToGroup(group.tempId)}>Add Product</Button>
              <Button variant="outline" onClick={() => setShowProductForm(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {group.products.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No products in this group</p>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Item #</th>
                  <th className="text-left p-2">Color</th>
                  <th className="text-left p-2">Description</th>
                  <th className="text-left p-2">Sizes</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Unit Price</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-center p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.products.map((product: NewProduct) => {
                  const qty = product.size2T + product.size3T + product.size4T +
                    product.sizeXS + product.sizeS + product.sizeM + product.sizeL +
                    product.sizeXL + product.size2XL + product.size3XL +
                    product.size4XL + product.size5XL + product.size6XL;
                  const sizeBreakdown = [
                    product.size2T && `2T:${product.size2T}`,
                    product.size3T && `3T:${product.size3T}`,
                    product.size4T && `4T:${product.size4T}`,
                    product.sizeXS && `XS:${product.sizeXS}`,
                    product.sizeS && `S:${product.sizeS}`,
                    product.sizeM && `M:${product.sizeM}`,
                    product.sizeL && `L:${product.sizeL}`,
                    product.sizeXL && `XL:${product.sizeXL}`,
                    product.size2XL && `2XL:${product.size2XL}`,
                    product.size3XL && `3XL:${product.size3XL}`,
                    product.size4XL && `4XL:${product.size4XL}`,
                    product.size5XL && `5XL:${product.size5XL}`,
                    product.size6XL && `6XL:${product.size6XL}`,
                  ].filter(Boolean).join(', ');
                  
                  return (
                    <tr key={product.tempId} className="border-t">
                      <td className="p-2">{product.itemNumber}</td>
                      <td className="p-2">{product.color}</td>
                      <td className="p-2">{product.description}</td>
                      <td className="p-2 text-xs">{sizeBreakdown}</td>
                      <td className="p-2 text-right">{qty}</td>
                      <td className="p-2 text-right">${parseFloat(product.unitPrice).toFixed(2)}</td>
                      <td className="p-2 text-right font-semibold">${(qty * parseFloat(product.unitPrice)).toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <Button size="sm" variant="ghost" onClick={() => removeProductFromGroup(group.tempId, product.tempId)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IMPRINTS SECTION */}
      <div className="space-y-3 pt-4 border-t-2 border-dashed">
        <div>
          <h4 className="font-medium text-sm">Imprints (Applied to ALL products above)</h4>
          <p className="text-xs text-muted-foreground">Each imprint adds setup fees + per-item costs to every product in this group</p>
        </div>

        {showImprintForm === group.tempId && (
          <div className="p-4 border rounded bg-blue-50 space-y-4">
            <h4 className="font-semibold">Add Imprint to Group</h4>
            <div className="grid grid-cols-5 gap-3">
              <div>
                <Label>Location *</Label>
                <Input placeholder="Front, Back, Left Chest" value={imprintForm.location} onChange={(e) => setImprintForm({ ...imprintForm, location: e.target.value })} />
              </div>
              <div>
                <Label>Method</Label>
                <Input value={imprintForm.method} onChange={(e) => setImprintForm({ ...imprintForm, method: e.target.value })} />
              </div>
              <div>
                <Label>Colors</Label>
                <Input type="number" value={imprintForm.colors} onChange={(e) => setImprintForm({ ...imprintForm, colors: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label>Setup Fee</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={imprintForm.setupFee} onChange={(e) => setImprintForm({ ...imprintForm, setupFee: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Per Item Price</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={imprintForm.perItemPrice} onChange={(e) => setImprintForm({ ...imprintForm, perItemPrice: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addImprintToGroup(group.tempId)}>Add Imprint</Button>
              <Button variant="outline" onClick={() => setShowImprintForm(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {group.imprints.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No imprints in this group</p>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-100">
                <tr>
                  <th className="text-left p-2">Location</th>
                  <th className="text-left p-2">Method</th>
                  <th className="text-right p-2">Colors</th>
                  <th className="text-right p-2">Setup Fee</th>
                  <th className="text-right p-2">Per Item</th>
                  <th className="text-center p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.imprints.map((imprint: NewImprint) => (
                  <tr key={imprint.tempId} className="border-t">
                    <td className="p-2">{imprint.location}</td>
                    <td className="p-2">{imprint.method}</td>
                    <td className="p-2 text-right">{imprint.colors}</td>
                    <td className="p-2 text-right">${imprint.setupFee.toFixed(2)}</td>
                    <td className="p-2 text-right">${imprint.perItemPrice.toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <Button size="sm" variant="ghost" onClick={() => removeImprintFromGroup(group.tempId, imprint.tempId)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Existing GroupSection component for viewing existing quotes
function GroupSection({ group, showProductForm, setShowProductForm, productForm, setProductForm, createProduct, deleteProduct, showImprintForm, setShowImprintForm, imprintForm, setImprintForm, createImprint, updateImprint, deleteImprint, editingImprintId, setEditingImprintId, totalQuantity }: any) {
  const { data: products = [] } = trpc.lineItems.listByGroup.useQuery({ groupId: group.id });
  const { data: imprints = [] } = trpc.imprints.listByGroup.useQuery({ groupId: group.id });

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{group.name}</h3>
          <p className="text-sm text-muted-foreground">{group.decorationMethod}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowProductForm(group.id)}>
            + Add Product
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowImprintForm(group.id)}>
            + Add Imprint
          </Button>
        </div>
      </div>

      {/* PRODUCTS SECTION */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">Products (Garments)</h4>
        
        {showProductForm === group.id && (
          <div className="p-4 border rounded bg-muted/30 space-y-4">
            <h4 className="font-semibold">Add Product to Group</h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Item #</Label>
                <Input placeholder="SKU" value={productForm.itemNumber} onChange={(e) => setProductForm({ ...productForm, itemNumber: e.target.value })} />
              </div>
              <div>
                <Label>Color</Label>
                <Input placeholder="Black, Navy, etc." value={productForm.color} onChange={(e) => setProductForm({ ...productForm, color: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Input placeholder="Product description" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
              </div>
              <div>
                <Label>Unit Price</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={productForm.unitPrice} onChange={(e) => setProductForm({ ...productForm, unitPrice: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Size Breakdown</Label>
              <div className="grid grid-cols-13 gap-2 mt-2">
                {['2T', '3T', '4T', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'].map((size) => {
                  const key = `size${size}` as keyof typeof productForm;
                  return (
                    <div key={size} className="space-y-1">
                      <Label className="text-xs">{size}</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        className="h-8"
                        value={productForm[key] || 0}
                        onChange={(e) => setProductForm({ ...productForm, [key]: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground mt-2">Total Quantity: {totalQuantity}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => {
                if (!productForm.itemNumber.trim()) {
                  alert('Item Number is required');
                  return;
                }
                if (!productForm.description.trim()) {
                  alert('Description is required');
                  return;
                }
                if (!productForm.unitPrice || parseFloat(productForm.unitPrice) <= 0) {
                  alert('Unit Price must be greater than 0');
                  return;
                }
                if (totalQuantity === 0) {
                  alert('Please enter at least one size quantity');
                  return;
                }
                createProduct.mutate({ ...productForm, groupId: group.id });
              }}>
                Add Product
              </Button>
              <Button variant="outline" onClick={() => setShowProductForm(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No products in this group</p>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Item #</th>
                  <th className="text-left p-2">Color</th>
                  <th className="text-left p-2">Description</th>
                  <th className="text-left p-2">Sizes</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Unit Price</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-center p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product: any) => {
                  const qty = (product.size2T || 0) + (product.size3T || 0) + (product.size4T || 0) + 
                    (product.sizeXS || 0) + (product.sizeS || 0) + (product.sizeM || 0) + 
                    (product.sizeL || 0) + (product.sizeXL || 0) + (product.size2XL || 0) + 
                    (product.size3XL || 0) + (product.size4XL || 0) + (product.size5XL || 0) + (product.size6XL || 0);
                  const sizeBreakdown = [
                    product.size2T && `2T:${product.size2T}`,
                    product.size3T && `3T:${product.size3T}`,
                    product.size4T && `4T:${product.size4T}`,
                    product.sizeXS && `XS:${product.sizeXS}`,
                    product.sizeS && `S:${product.sizeS}`,
                    product.sizeM && `M:${product.sizeM}`,
                    product.sizeL && `L:${product.sizeL}`,
                    product.sizeXL && `XL:${product.sizeXL}`,
                    product.size2XL && `2XL:${product.size2XL}`,
                    product.size3XL && `3XL:${product.size3XL}`,
                    product.size4XL && `4XL:${product.size4XL}`,
                    product.size5XL && `5XL:${product.size5XL}`,
                    product.size6XL && `6XL:${product.size6XL}`,
                  ].filter(Boolean).join(', ');
                  
                  return (
                    <tr key={product.id} className="border-t">
                      <td className="p-2">{product.itemNumber}</td>
                      <td className="p-2">{product.color}</td>
                      <td className="p-2">{product.description}</td>
                      <td className="p-2 text-xs">{sizeBreakdown}</td>
                      <td className="p-2 text-right">{qty}</td>
                      <td className="p-2 text-right">${(parseFloat(product.unitPrice as any) || 0).toFixed(2)}</td>
                      <td className="p-2 text-right font-semibold">${(qty * (parseFloat(product.unitPrice as any) || 0)).toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <Button size="sm" variant="ghost" onClick={() => deleteProduct.mutate({ id: product.id })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IMPRINTS SECTION */}
      <div className="space-y-3 pt-4 border-t-2 border-dashed">
        <div>
          <h4 className="font-medium text-sm">Imprints (Applied to ALL products above)</h4>
          <p className="text-xs text-muted-foreground">Each imprint adds setup fees + per-item costs to every product in this group</p>
        </div>

        {showImprintForm === group.id && (
          <div className="p-4 border rounded bg-blue-50 space-y-4">
            <h4 className="font-semibold">Add Imprint to Group</h4>
            <div className="grid grid-cols-5 gap-3">
              <div>
                <Label>Location</Label>
                <Input placeholder="Front, Back, Left Chest" value={imprintForm.location} onChange={(e) => setImprintForm({ ...imprintForm, location: e.target.value })} />
              </div>
              <div>
                <Label>Method</Label>
                <Input value={imprintForm.method} onChange={(e) => setImprintForm({ ...imprintForm, method: e.target.value })} />
              </div>
              <div>
                <Label>Colors</Label>
                <Input type="number" value={imprintForm.colors} onChange={(e) => setImprintForm({ ...imprintForm, colors: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label>Setup Fee</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={imprintForm.setupFee} onChange={(e) => setImprintForm({ ...imprintForm, setupFee: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Per Item Price</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={imprintForm.perItemPrice} onChange={(e) => setImprintForm({ ...imprintForm, perItemPrice: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => {
                if (!imprintForm.location.trim()) {
                  alert('Imprint Location is required');
                  return;
                }
                if (imprintForm.colors < 1) {
                  alert('Number of colors must be at least 1');
                  return;
                }
                if (imprintForm.setupFee < 0) {
                  alert('Setup Fee cannot be negative');
                  return;
                }
                if (imprintForm.perItemPrice < 0) {
                  alert('Per Item Price cannot be negative');
                  return;
                }
                
                if (editingImprintId) {
                  updateImprint.mutate({ 
                    id: editingImprintId,
                    location: imprintForm.location,
                    decorationMethod: imprintForm.method,
                    colors: imprintForm.colors,
                    setupFee: imprintForm.setupFee.toString(),
                    unitPrice: imprintForm.perItemPrice.toString(),
                  });
                } else {
                  createImprint.mutate({ 
                    groupId: group.id,
                    location: imprintForm.location,
                    decorationMethod: imprintForm.method,
                    colors: imprintForm.colors,
                    setupFee: imprintForm.setupFee.toString(),
                    unitPrice: imprintForm.perItemPrice.toString(),
                  });
                }
              }}>
                {editingImprintId ? 'Update Imprint' : 'Add Imprint'}
              </Button>
              <Button variant="outline" onClick={() => {
                setShowImprintForm(null);
                setEditingImprintId(null);
                setImprintForm({ tempId: "", location: "", method: "Screen Print", colors: 1, setupFee: 0, perItemPrice: 0 });
              }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {imprints.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No imprints added yet</p>
        ) : (
          <div className="border rounded overflow-hidden bg-blue-50/30">
            <table className="w-full text-sm">
              <thead className="bg-blue-100">
                <tr>
                  <th className="text-left p-2">Location</th>
                  <th className="text-left p-2">Method</th>
                  <th className="text-center p-2">Colors</th>
                  <th className="text-right p-2">Setup Fee</th>
                  <th className="text-right p-2">Per Item</th>
                  <th className="text-center p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {imprints.map((imprint: any) => (
                  <tr key={imprint.id} className="border-t">
                    <td className="p-2">{imprint.location}</td>
                    <td className="p-2">{imprint.method}</td>
                    <td className="p-2 text-center">{imprint.colors}</td>
                    <td className="p-2 text-right">${(parseFloat(imprint.setupFee as any) || 0).toFixed(2)}</td>
                    <td className="p-2 text-right">${(parseFloat(imprint.unitPrice as any) || 0).toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingImprintId(imprint.id);
                        setShowImprintForm(group.id);
                        setImprintForm({
                          tempId: "",
                          location: imprint.location || "",
                          method: imprint.decorationMethod || "Screen Print",
                          colors: imprint.colors || 1,
                          setupFee: parseFloat(imprint.setupFee || "0"),
                          perItemPrice: parseFloat(imprint.unitPrice || "0"),
                        });
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteImprint.mutate({ id: imprint.id })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>




    </div>
  );
}

