# WooCommerce Swell Migration Tool
Migrate categories, products, product images, and customers from WooCommerce to Swell.
View roadmap and release notes [here](https://github.com/vettloffah/woo-swell-migrate/wiki).
Typescript library. Pure ESM module - cannot be imported with `require`. Must use `import` syntax.

#### Background
My business migrated from WooCommerce to Swell, and there weren't any migration tools available. So as I was working through the migration for my own business I created this library.

#### Contributing
If anyone would like to write tests for this library, that would be great. I had issues with getting jest to work with this pure ESM module. Other contributions welcome as well. Just fork the repo and submit a pull request.

#### Requirements
This was developed and tested using WooCommerce REST API version 3 and Node v16. It has not been tested with other tech stacks.

The unique identifier used to match products, categories, and images is the `slug` field. If, for some reason, your products and categories don't have a `slug` in woocommerce, you would need to modify the library to use a different unique identifier.

#### Getting Started
The below script will migrate your entire store to Swell.

```js
const WooSwell = import 'woo-swell-migrate';

 /** 
  * Woo API key generated in woocommerce settings -> advanced 
  * Read only access required. 
  * 
  * Swell API key generated in developer tab. 
  * Read and write access required.
  * */

const wooConfig = {
    consumerSecret: "cs_xxxx", 
    consumerKey: "ck_xxxx",
    url: "https://example.com"
    }

const swellConfig = {
    store: "mystore",
    key: "xxxxxxxx"
}

const paths = {
    /** 
     * This library will save json files in this folder. The json files 
     * prevent the need to make as many API calls if you run into issues 
     * with importing and need to run the migration again. Supply the option 
     * `loadFromFile: true` in the functions that accept it to use this feature.
     */
    data: './data',
    /**
     * Specify the folder where you have downloaded a backup of your
     * wordpress media files. Required only if you are using this tool 
     * to migrate your product images.
     */ 
    images: './site-backup/wp-content/uploads/'
}

const ws = new WooSwell(wooConfig, swellConfig, paths)

/** first step is to create categories in swell that exist in woo. */
await ws.createOrUpdateCategories()

/** create category parent / child relationships. This must be done after categories are created*/
await ws.addCategoryParents()

/** 
 * clear out swell categories that don't match woo categories.
 * Useful for clearing out demo categories.
 */
await ws.deleteUnmatchedCategories()

/**
 * Next step is to migrate products - this will take a while with a lot of products
 * If you have a large database (more than a few thousand products), 
 * you can choose to break it up by supplying the { pages: { first: number, last: number  } } 
 * option. See documentation below.
 */
await ws.createOrUpdateProducts()

/** 
 * Import images. The folder path was specified in the constructor
 * By default, files will not be uploaded if a file with the same filename exists in swell already
 * You can override this default behavior in the options parameter: { skipDuplicates: false }
 */
await ws.uploadImagesFromFolder();

/**
 * After files are uploaded, they must be attached to the product record by updating 
 * each product.
 */
await ws.attachImagesToProducts();

/**
 * Migrate customers in batches. Duplicate records will be skipped.  
 * This uses the swell `migrate` feature, which is faster for large record sets.
 * Specify number of woocommerce pages to migrate per batch. Swell recommends 
 * less than 1,000 records per batch, which would be 100 pages at the default 
 * 10 records per page in woocommerce.
 */
 await ws.migrateCustomers({ pagesPerBatch: 50 })

```
After that, your store should be pretty close to what it is in WooCommerce, assuming your woocommerce store hasn't been too customized.

### Default fields supported

**Products:** 
Fields: name, slug, sku, description, tags, dimensions, price, sales price, category, images (separately, see below), stock level, active.

**Categories:** 
Categories are imported, and non matching categories are cleaned iup.  
Fields: name, slug, parent

**Product Images**
Images are uploaded from a folder on local machine, then linked to products.  
Fields: filename, caption / alt, dimensions, url

**Customers / Accounts**
Fields: email, first name, last name, name, phone, 
type (business or individual), billing address, shipping address.

### Custom Fields
If your wordpress / woo instance has custom fields that need to be migrated (or you want to import additional fields 
that aren't in the default list above) you can specify them when executing the `createOrUpdateProducts` function.

Note: Custom fields in woocommerce are not included by default in the API. The WooCommerce REST API would need to be 
customized.

```js
const customFields = [
        { woo: 'my_woo_field1': swell: 'my_swell_field_1' }, 
        { woo: 'my_field2', swell: 'my_field2' }
    ]

await ws.createOrUpdateProducts({ customFields });

```

### Method Options Details

#### createOrUpdateProducts(options)

1. `pages: { first?: number, last?: number }`. Specify API pagination range of products from woocommerce to sync. 
Useful for importing in batches, or if importing get interrupted. 
Omit the `last` page property to start at a certain page and complete to the end.
By default, **all pages** are loaded.
2. `loadFromFile: boolean`. The first time this method is executed, it saves a json file to the `data` folder path specified in the constructor. If something breaks and you need to execute this again, you can load from the local file instead of calling the woocommerce API. If the file doesn't exist, it falls back to calling the API.
Defaults to **false**. Even if set to true, this will be set to false if supplying the `pages` option, since the json file will likely not be the pages intended to import.
3. `customFields: [{ woo: string, swell: string }]`. An array of field mappings for custom fields. See `custom fields` documentation above. 
```js
// example

const options = {
    pages: { first: 30, last: 40 },
    loadFromFile: false,
    customFields: [
        { woo: 'my_woo_field_name', swell: 'my_swell_field_name' }
    ]
}

await ws.createOrUpdateProducts(options);
```

#### uploadImagesFromFolder(options)
1. `skipDuplicates: boolean` checks for existing swell files with the same `filename` field, and skips them if they match. If set to false, will upload files with existing filenames.
Defaults to **true**
2. `loadFromFile: boolean` the first time this method is executed, it saves a json file with woocommerce product image meta data. If set to true, AND the file exists, it will load from the json file instead of calling the woocommerce API again.
```js
// example

const options = { skipDuplicates: true, loadFromFile: true }

await ws.uploadImagesFromFolder(options);
```

#### migrateCustomers(options)
1. `pagesPerBatch: number` how many pages of woocommerce records to import to swell in each batch.  
Swell recommends less than 1,000 records per `migrate` request, which would be 100 pages of woocommerce 
records at the default of 10 records per page.

2. `pages: { first?: number, last?: number }` if migration gets interrupted, you can start where you 
left off by supplying a first page. 
```js
// example
const { created, skipped } = await ws.migrateCustomers({ pagesPerBatch: 75, pages: { first: 175 } });
```

## All Available Methods
See the source code for more complete documentation of all methods.

##### createOrUpdateCategories()
Creates categories in Swell, or updates them if they exist already

##### addCategoryParents()
Creates the parent / child relationship in categories

##### deleteUnmatchedCategories()
Delete categories in Swell that don't exist in the downloaded woocommerce data.

##### createOrUpdateProducts(options)
Create or update products in Swell

##### getWooProducts(options)
Returns an array of product objects from woocommerce

##### getSwellCategories(options)
Returns an array of category objects from swell

##### getTotalPages(endpoint)
Returns the number of total number of pages from woo API endpoint (calls the API once to get the data)

##### getAllPagesSwell(endpoint, options)
Returns all (by default) or some of the pages of swell records

##### getAllPagesWoo(endpoint, options)
Returns all (by default) or some of the pages of woo records

##### uploadImagesFromFolder(options)
Uploads image files to swell from local folder.

##### getImageListFromWoo(options)
Generate an object where the key is the product slug, and the value is an array of images data.

##### attachImagesToProducts()
Updates product records in Swell to link the uploaded images.

##### migrateCustomers(options)
Migrate customer records in batches from woocommerce to swell.

##### deleteAllProducts()
Delete all products from Swell. Useful for clearing out demo products.