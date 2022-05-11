export interface Order {
    id                                    ?: string;
    account_id                            ?: string;
    account_info_saved                    ?: boolean;
    account_logged_in                     ?: boolean;
    authorized_payment_id                 ?: boolean;
    billing                               ?: Address;
    cart_id                               ?: string;
    comments                              ?: null;
    coupon_code                           ?: string;
    coupon_id                             ?: string;
    currency                              ?: string;
    date_created                          ?: Date;
    date_updated                          ?: Date;
    date_webhook_first_failed             ?: null;
    delivered                             ?: boolean;
    discount_total                        ?: number;
    discounts                             ?: OrderDiscount[];
    gift_message                          ?: null;
    giftcard_total                        ?: number;
    giftcards                             ?: Giftcard[];
    gift                                  ?: boolean;
    grand_total                           ?: number;
    guest                                 ?: boolean;
    hold                                  ?: boolean;
    item_discount                         ?: number;
    item_quantity                         ?: number;
    item_quantity_canceled                ?: number;
    item_quantity_deliverable             ?: number;
    item_quantity_delivered               ?: number;
    item_quantity_giftcard_deliverable    ?: number;
    item_quantity_returnable              ?: number;
    item_quantity_returned                ?: number;
    item_quantity_shipment_deliverable    ?: number;
    item_quantity_subscription_deliverable?: number;
    item_shipment_weight                  ?: number;
    item_tax                              ?: number;
    items                                 ?: Item[];
    notes                                 ?: null;
    number                                ?: number;
    paid                                  ?: boolean;
    payment_balance                       ?: number;
    payment_marked                        ?: boolean;
    payment_total                         ?: number;
    promotion_ids                         ?: null;
    refund_total                          ?: number;
    refunded                              ?: boolean;
    return_credit_tax                     ?: number;
    return_credit_total                   ?: number;
    return_item_tax                       ?: number;
    return_item_tax_included              ?: number;
    return_item_total                     ?: number;
    return_total                          ?: number;
    shipment_delivery                     ?: boolean;
    shipment_discount                     ?: number;
    shipment_price                        ?: number;
    shipment_rating                       ?: ShipmentRating;
    shipment_tax_included_total           ?: number;
    shipment_total                        ?: number;
    shipping                              ?: Address;
    status                                ?: OrderStatus;
    sub_total                             ?: number;
    tax_total                             ?: number;
    taxes                                 ?: Tax[];
    webhook_attempts_failed               ?: null;
    webhook_response                      ?: null;
    webhook_status                        ?: number;
}

export interface ExpandedOrder extends Order {
    account?: Account,
    items  ?: [ExpandedItem]
}

export enum OrderStatus {
    "pending", "draft", "payment_pending", "delivery_pending", "hold", "complete", "canceled"
}

export interface Account {
    id?: string;
    email?: string;
    balance?: number;
    billing?: Address;
    cart_abandoned_count?: number;
    currency?: string;
    date_created?: Date;
    date_first_cart_abandoned?: Date;
    date_first_order?: Date;
    date_last_cart_abandoned?: Date;
    date_last_login?: Date;
    date_last_order?: Date;
    date_updated?: Date;
    first_name?: string;
    group?: string;
    last_name?: string;
    name?: string;
    order_value?: number;
    password?: string;
    password_reset_key?: null;
    password_reset_url?: null;
    phone?: string;
    shipping?: Address;
    type?: "business" | "individual";

}

export interface Address {
    name?: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: number;
    country?: string;
    phone?: string;
    method?: string;
    card?: Card;
    account_card_id?: string;
    account_address_id?: string;
}

export interface Card {
    token?: string;
    test?: boolean;
    last4?: string;
    brand?: string;
    address_check?: string;
    zip_check?: string;
    cvc_check?: string;
    exp_month?: number;
    exp_year?: number;
    fingerprint?: string;
}

export interface OrderDiscount {
    id    ?: string;
    type  ?: string;
    amount?: number;
    rule  ?: Rule;
}

export interface Rule {
    type        ?: string;
    value_type  ?: string;
    value_amount?: number;
    product_id  ?: string;
}

export interface Giftcard {
    id            ?: string;
    amount        ?: number;
    code          ?: string;
    code_formatted?: string;
    last4         ?: string;
}

export interface Item {
    readonly id                           ?: string;
             product_id                   ?: string;
             variant_id                   ?: string;
             quantity                     ?: number;
             price                        ?: number;
             price_total                  ?: number;
             orig_price                   ?: number;
             delivery                     ?: string;
             shipment_weight              ?: number;
             options                      ?: Option[];
             discounts                    ?: TaxElement[];
             discount_each                ?: number;
             discount_total               ?: number;
             taxes                        ?: TaxElement[];
             tax_each                     ?: number;
             tax_total                    ?: number;
             quantity_canceled            ?: number;
             quantity_delivered           ?: number;
             quantity_deliverable         ?: number;
             quantity_shipment_deliverable?: number;
             product_name                 ?: string;
}

export interface ExpandedItem extends Item {
    product?: Product
}

export interface Payment {
    id               ?: string;
    account_id       ?: string;
    amount           ?: number;
    method           ?: string;
    account_card_id  ?: string;
    amount_refundable?: number;
    amount_refunded  ?: number;
    async            ?: boolean;
    authorized       ?: boolean;
    captured         ?: boolean;
    card             ?: Card;
    currency         ?: string;
    date_created     ?: Date;
    date_updated     ?: Date;
    error            ?: null;
    gateway          ?: string;
    number           ?: number;
    order_id         ?: string;
    status           ?: string;
    success          ?: boolean;
    test             ?: boolean;
    transaction_id   ?: string;
}

export interface TaxElement {
    id    ?: string;
    amount?: number;
}

export interface ProductOption {
    id     ?: string;
    name   ?: string;
    value  ?: string;
    variant?: boolean;
}

export interface ShipmentRating {
    fingerprint?: string;
    services   ?: Service[];
    errors     ?: null;
}

export interface Service {
    id   ?: string;
    name ?: string;
    price?: number;
}

export interface Tax {
    id      ?: string;
    name    ?: string;
    priority?: number;
    rate    ?: number;
    amount  ?: number;
}

export interface Product {
    id                 ?: string;
    name               ?: string;
    active             ?: boolean;
    attributes         ?: Attributes;
    cost               ?: number;
    cross_sells        ?: CrossSell[];
    currency           ?: string;
    customizable       ?: boolean;
    date_created       ?: Date;
    date_updated       ?: Date;
    delivery           ?: string;
    description        ?: string;
    images             ?: Image[];
    meta_description   ?: null;
    meta_keywords      ?: null;
    meta_title         ?: null;
    options            ?: ProductOption[];
    price              ?: number;
    prices             ?: Price[];
    review_rating      ?: number;
    sale               ?: boolean;
    sale_price         ?: number;
    shipment_dimensions?: ShipmentDimensions;
    sku                ?: string;
    slug               ?: string;
    stock_level        ?: number;
    stock_tracking     ?: boolean;
    tags               ?: string[];
    type               ?: string;
    up_sells           ?: UpSell[];
    variable           ?: boolean;
    category_index     ?: object;
    category_id        ?: string; // primary category
    shipment_weight    ?: number; // float

    /** custom fields */
    [key: string]: unknown;
}

interface Response {
    count  : number;
    page   : number;
    pages  : ResultPage[];
}

export interface ProductResponse extends Response {
    results: Product[];
}

export interface CategoryResponse extends Response {
    results: Category[];
}

export interface FileResponse extends Response {
    results: File[]
}

export interface GenericResponse extends Response {
    results: { [key: string]: unknown }[]
}

export interface ResultPage {
    [pageNum: number]: { start: number, end: number }
}

export interface Attributes {
    material?: string;
    wash    ?: string;
    fit     ?: string;
    example ?: boolean;
}

export interface CrossSell {
    id              ?: string;
    product_id      ?: string;
    discount_type   ?: string;
    discount_percent?: number;
}

export interface Image {
    id     ?: string;
    caption?: string;
    file   ?: File;
}

export interface File {
    id          : string;
    length      : number;
    md5         : string;
    content_type: string;
    url         : string;
    width       : number;
    height      : number;
    filename    : string;
}

export interface Option {
    id     ?: string;
    name   ?: string;
    variant?: boolean;
    values ?: Value[];
}

export interface Value {
    id    ?: string;
    name  ?: string;
    price ?: number;
}

export interface Price {
    price         ?: number;
    quantity_min  ?: number;
    quantity_max  ?: number;
    account_group ?: string;
}

export interface ShipmentDimensions {
    length?: number;
    width ?: number;
    height?: number;
    unit  ?: string;
}

export interface UpSell {
    id        ?: string;
    product_id?: string;
}

export interface Product {
    id                ?: string;
    name              ?: string;
    active            ?: boolean;
    codes             ?: Code[];
    currency          ?: string;
    date_created      ?: Date;
    date_expired      ?: Date;
    date_updated      ?: Date;
    date_valid        ?: Date;
    description       ?: string;
    discount_group    ?: null;
    discounts         ?: Discount[];
    limit_account_uses?: number;
    limit_code_uses   ?: number;
    limit_uses        ?: number;
    multi_codes       ?: boolean;
    use_count         ?: number;
}

export interface Code {
    code?: string;
}

export interface Discount {
    type       ?: string;
    category_id?: string;
    value_type ?: string;
    value_fixed?: number;
}


export interface Stock {
    id            ?: string
    parent_id     ?: string
    date_created  ?: string
    date_updated  ?: string
    level         ?: number
    number        ?: number
    reason        ?: Reason
    reason_message?: string
    variant_id    ?: string
}

declare enum Reason {
    "received", "returned", "canceled", "sold", "missing", "damaged"
}

export interface Category {
    name: string
    active?: boolean
    sorting?: any
    images?: any
    description?: string;    
    meta_title?: string
    meta_description?: string
    parent_id?: string
    slug: string
    top_id?: any
    date_created?: string
    id?: string
  }
