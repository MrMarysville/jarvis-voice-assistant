/**
 * Form Validation Utilities
 * 
 * Reusable validation functions for forms
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateRequired(value: any, fieldName: string): string | null {
  if (value === null || value === undefined || value === "") {
    return `${fieldName} is required`;
  }
  if (typeof value === "string" && value.trim() === "") {
    return `${fieldName} cannot be empty`;
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return null; // Allow empty if not required
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address";
  }
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone) return null; // Allow empty if not required
  const phoneRegex = /^[\d\s\-\(\)\+]+$/;
  if (!phoneRegex.test(phone)) {
    return "Please enter a valid phone number";
  }
  return null;
}

export function validateNumber(value: any, fieldName: string, options?: {
  min?: number;
  max?: number;
  integer?: boolean;
}): string | null {
  const num = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return `${fieldName} must be a valid number`;
  }
  
  if (options?.integer && !Number.isInteger(num)) {
    return `${fieldName} must be a whole number`;
  }
  
  if (options?.min !== undefined && num < options.min) {
    return `${fieldName} must be at least ${options.min}`;
  }
  
  if (options?.max !== undefined && num > options.max) {
    return `${fieldName} must be at most ${options.max}`;
  }
  
  return null;
}

export function validateCurrency(value: string, fieldName: string): string | null {
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return `${fieldName} must be a valid amount`;
  }
  
  if (num < 0) {
    return `${fieldName} cannot be negative`;
  }
  
  // Check for more than 2 decimal places
  if (value.includes(".") && value.split(".")[1].length > 2) {
    return `${fieldName} can have at most 2 decimal places`;
  }
  
  return null;
}

export function validateDate(date: Date | string | null, fieldName: string): string | null {
  if (!date) return null; // Allow empty if not required
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return `${fieldName} must be a valid date`;
  }
  
  return null;
}

/**
 * Validate an entire form object
 */
export function validateForm<T extends Record<string, any>>(
  data: T,
  rules: Record<keyof T, (value: any) => string | null>
): ValidationResult {
  const errors: Record<string, string> = {};
  
  for (const [field, validator] of Object.entries(rules)) {
    const error = validator(data[field]);
    if (error) {
      errors[field] = error;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Quote-specific validations
 */
export function validateQuote(quote: {
  customerId?: string;
  dueDate?: Date | null;
}) {
  return validateForm(quote, {
    customerId: (value) => validateRequired(value, "Customer"),
    dueDate: (value) => validateDate(value, "Due date"),
  });
}

/**
 * Customer-specific validations
 */
export function validateCustomer(customer: {
  name?: string;
  email?: string;
  phone?: string;
}) {
  return validateForm(customer, {
    name: (value) => validateRequired(value, "Customer name"),
    email: (value) => customer.email ? validateEmail(value) : null,
    phone: (value) => customer.phone ? validatePhone(value) : null,
  });
}

/**
 * Line item-specific validations
 */
export function validateLineItem(item: {
  itemNumber?: string;
  description?: string;
  unitPrice?: string;
  quantity?: number;
}) {
  return validateForm(item, {
    itemNumber: (value) => validateRequired(value, "Item number"),
    description: (value) => validateRequired(value, "Description"),
    unitPrice: (value) => {
      const required = validateRequired(value, "Unit price");
      if (required) return required;
      return validateCurrency(value, "Unit price");
    },
    quantity: (value) => {
      if (value === 0) return "Quantity must be greater than 0";
      return validateNumber(value, "Quantity", { min: 1, integer: true });
    },
  });
}

/**
 * Imprint-specific validations
 */
export function validateImprint(imprint: {
  location?: string;
  colors?: number;
  setupFee?: string;
  unitPrice?: string;
}) {
  return validateForm(imprint, {
    location: (value) => validateRequired(value, "Imprint location"),
    colors: (value) => validateNumber(value, "Number of colors", { min: 1, integer: true }),
    setupFee: (value) => validateCurrency(value || "0", "Setup fee"),
    unitPrice: (value) => validateCurrency(value || "0", "Per-item price"),
  });
}

