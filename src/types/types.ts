import { WooCommerceRestApiVersion } from "@woocommerce/woocommerce-rest-api/index.mjs";

export type SwellConfig = {
    store: string,
    key: string
}

export type WooConfig = {
    url: string,
    consumerKey: string,
    consumerSecret: string,
    version?: WooCommerceRestApiVersion
}

export type WooSwellConfig = {
    woo: WooConfig
    swell: SwellConfig
}

export type DirPaths = {
    data: string,
    images: string
}

export type FilePaths = {
    wooImageFiles: string,
    wooImageJson: string,
    wooProducts: string,
    wooCustomers: string,
    swellProducts: string,
    swellCategories: string,
    swellAccounts: string,
}

export type CategoryObject = {
    [slug: string]: string;
}

export type WooImage = {
    filename: string,
    caption: string,
    name: string
    productSlug: string
}

export type WooImageObj = {
    [slug: string]: WooImage[]
}

export type SwellFile = {
    filename: string,
    path: string
}

/** map the name of the woo field to the swell field */
export type FieldMap = {
    woo: string, swell: string
}
export type CreateProductOptions = {
    loadFromFile?: boolean,
    customFields?: FieldMap[],
    pages?: { first: number, last: number }
}

export type Pages = {
    first: number, last: number
}

export type GetWooProductsOptions = {
    loadFromFile?: boolean,
    jsonFilePath?: string,
    pages?: Pages
}

export type GetAllPagesWooOptions = {
    pages?: Pages,
    limit?: number
}

export type GetImageListFromWooOptions = {
    loadFromFile?: boolean,
}

export type GetSwellCategoriesOptions = {
    loadFromFile?: boolean
}

export type SwellQueryOptions = {
    where?: { [key: string]: any },
    sort?: string,
    limit?: number,
    search?: string,
    expand?: string | Array<string>,
    include?: { [key: string]: any }
}
export type GetAllPagesSwellOptions = {
    pages?: Pages,
    queryOptions?: SwellQueryOptions
}

export type UploadImagesFromFolderOptions = {
    loadFromFile?: boolean
    skipDuplicates?: boolean,
}

export type FileDetail = {
    filename: string,
    path: string
}

export type MigrateCustomersOptions = {
    pagesPerBatch?: number,
    pages?: Pages
}

export type MigrateCustomersCount = {
    created: number,
    skipped: number
}

export type MigrateOrdersOptions = {
    pagesPerBatch?: number,
    pages?: Pages,
    loadFromFile?: boolean
}

export type MigrateOrdersCount = {
    created: number,
    skipped: number
}
