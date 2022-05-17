export interface Product {
    id:                     number
    name:                   string
    slug:                   string
    permalink?:             string
    date_created?:          string
    date_created_gmt?:      string
    date_modified?:         string
    date_modified_gmt?:     string
    type?:                  string
    status?:                string
    featured?:              boolean
    catalog_visibility?:    string
    description?:           string
    short_description?:     string
    sku?:                   string
    price?:                 string
    regular_price?:         string
    sale_price?:            string
    date_on_sale_from?:     any
    date_on_sale_from_gmt?: any
    date_on_sale_to?:       any
    date_on_sale_to_gmt?:   any
    on_sale?:               boolean
    purchasable?:           boolean
    total_sales?:           number
    virtual?:               boolean
    downloadable?:          boolean
    downloads?:             any[]
    download_limit?:        number
    download_expiry?:       number
    external_url?:          string
    button_text?:           string
    tax_status?:            string
    tax_class?:             string
    manage_stock?:          boolean
    stock_quantity?:        any
    backorders?:            string
    backorders_allowed?:    boolean
    backordered?:           boolean
    sold_individually?:     boolean
    weight?:                string
    dimensions?:            Dimensions
    shipping_required?:     boolean
    shipping_taxable?:      boolean
    shipping_class?:        string
    shipping_class_id?:     number
    reviews_allowed?:       boolean
    average_rating?:        string
    rating_count?:          number
    upsell_ids?:            number[]
    cross_sell_ids?:        number[]
    parent_id?:             number
    purchase_note?:         string
    categories?:            Category[]
    tags?:                  any[]
    images?:                Image[]
    attributes?:            any[]
    default_attributes?:    any[]
    variations?:            any[]
    grouped_products?:      any[]
    menu_order?:            number
    price_html?:            string
    related_ids?:           number[]
    meta_data?:             MetaDaum[]
    stock_status?:          string
    _links?:                Links

    /** custom fields */
    [key: string]: unknown;
  }

  export interface Dimensions {
    length: string
    width: string
    height: string
  }

  export interface Category {
    id? : number
    name: string
    slug: string,
    description?: string
  }

  export interface Image {
    id : number
    date_created? : string
    date_created_gmt? : string
    date_modified? : string
    date_modified_gmt?: string
    src : string
    name : string
    alt : string
  }

  export interface Links {
    self? : Self[]
    collection?: Collection[]
  }

  export interface Customer {
    id: number
    date_created?: string
    date_created_gmt?: string
    date_modified?: string
    date_modified_gmt?: string
    email: string
    first_name?: string
    last_name?: string
    role?: string
    username?: string
    billing?: Billing
    shipping?: Shipping
    is_paying_customer?: boolean
    avatar_url?: string
    meta_data?: MetaDaum[]
    _links?: Links
  }

  export interface Billing {
    first_name?: string
    last_name?: string
    company?: string
    address_1?: string
    address_2?: string
    city?: string
    postcode?: string
    country?: string
    state?: string
    email: string
    phone?: string
  }

  export interface Shipping {
    first_name?: string
    last_name?: string
    company?: string
    address_1?: string
    address_2?: string
    city?: string
    postcode?: string
    country?: string
    state?: string
  }

  export interface MetaDaum {
    id: number
    key: string
    value: any
  }

  export interface Self {
    href: string
  }

  export interface Collection {
    href: string
  }

export interface Order {
  id: number;
  parent_id: number;
  number: string;
  order_key: string;
  created_via: string;
  version: string;
  status: Status;
  currency: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  prices_include_tax: boolean;
  customer_id: number;
  customer_ip_address: string;
  customer_user_agent: string;
  customer_note: string;
  billing: Billing;
  shipping: Shipping;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  date_paid: string;
  date_paid_gmt: string;
  date_completed: null;
  date_completed_gmt: null;
  cart_hash: string;
  meta_data: MetaDaum[];
  line_items: LineItem[];
  tax_lines: TaxLine[];
  shipping_lines: ShippingLine[];
  fee_lines: any[];
  coupon_lines: any[];
  refunds: any[];
  _links: Links;
}

export type Status =
  "pending" | "processing" | "on-hold" | "completed" | "cancelled" | "refunded" | "failed" | "trash"

export interface LineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  tax_class: string;
  subtotal: string;
  subtotal_tax: string;
  total: string;
  total_tax: string;
  taxes: Tax[];
  meta_data: MetaDaum[];
  sku: string;
  price: number;
}

export interface Tax {
  id: number;
  total: string;
  subtotal: string;
}

export interface ShippingLine {
  id: number;
  method_title: string;
  method_id: string;
  total: string;
  total_tax: string;
  taxes: any[];
  meta_data: any[];
}

export interface TaxLine {
  id: number;
  rate_code: string;
  rate_id: number;
  label: string;
  compound: boolean;
  tax_total: string;
  shipping_tax_total: string;
  meta_data: any[];
}
