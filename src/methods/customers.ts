
import WooSwell from "../index";
import fs from "fs";
import * as Log from "../utils/Log.js";
import chalk from "chalk";

import * as Woo from "../types/WooCommerce";
import * as Swell from "../types/Swell";
import { MigrateCustomersCount, MigrateCustomersOptions, Pages } from "../types/types";

 /** confirm account was created by checking type of response */
 function isAccount(obj: any): obj is Swell.Account {
    return obj.id !== undefined;
}

/**
 * 
 * @param options 
 * @param options.loadFromFile
 * @param options.pages
 */
export async function getWooCustomers(this: WooSwell, options?: { loadFromFile?: boolean, pages?: Pages }) {
    let customers: Woo.Customer[] = [];

    if (options?.loadFromFile && !options.pages && fs.existsSync(this.paths.wooImageJson)) {
        customers = JSON.parse(fs.readFileSync(this.paths.wooCustomers, "utf-8")) as Woo.Customer[];
        Log.info(`${Object.keys(customers).length} customer records loaded from ${this.paths.wooCustomers}`);
        return customers;
    }

    customers = await this.getAllPagesWoo("customers", options) as Woo.Customer[];
    return customers;
}

export async function getSwellCustomers(this: WooSwell, options?: { loadFromFile?: boolean, pages?: Pages }) {
    let customers: Swell.Account[] = [];

    if (options?.loadFromFile && !options.pages && fs.existsSync(this.paths.wooImageJson)) {
        customers = JSON.parse(fs.readFileSync(this.paths.wooCustomers, "utf-8")) as Swell.Account[];
        Log.info(`${Object.keys(customers).length} customer records loaded from ${this.paths.wooCustomers}`);
        return customers;
    }

    customers = await this.getAllPagesSwell("/accounts", options) as Swell.Account[];
    return customers;
}

/**
 * 
 * Migrate customers in batches using the Swell `migrate` feature.  
 * Duplicate records will be skipped (using `email` field as unique identifier)
 * 
 * @param options 
 * 
 * @param options.pagesPerBatch how many woocommerce pages of customer records to import per batch.  
 * The default number of records per page is 100. Swell recommends less than 1,000 
 * records per batch, which would be 10 pages. Defaults to 1.
 * 
 * @param options.pages if you want to only migrate a subset of woocommerce pages of customers 
 * records, provide the pages option. `pages: { first: 10, last: 20 }`. You can omit the `last` 
 * page property to start migration at a certain point and continue to the end. example:
 * `pages: { first: 10 }`
 */
export async function migrateCustomers(this: WooSwell, options?: MigrateCustomersOptions): Promise<MigrateCustomersCount> {
    const count = { created: 0, skipped: 0 };
    const totalPages = await this.getTotalPages("customers", 100);
    const pagesPerBatch = options?.pagesPerBatch || 1;
    const firstPage = options?.pages?.first || 1;
    const lastPage = options?.pages?.last || totalPages;

    /** loop through batches of pages  */
    for (let i = firstPage; i <= lastPage; i += pagesPerBatch) {
        /** calculate last page of batch based on pages per batch */
        const last = (i + pagesPerBatch - 1) < lastPage ? (i + pagesPerBatch - 1) : lastPage;

        /** get the pages of records */
        const wooCustomers = await this.getAllPagesWoo("customers", {
            pages: { first: i, last },
        }) as Woo.Customer[];

        /** build the batch payload for import */
        const batchPayload = wooCustomers.map(customer => {
            return ({ url: "/accounts", data: _getAccountObjFromCustomer.call(this, customer), method: "POST" });
        });

        /** create records */
        Log.info(`attempting to create ${batchPayload.length} records`);
        const res = await this.swell.post("/:batch", batchPayload);
        let created = 0; let skipped = 0;

        res.forEach((element: Swell.ErrorResponse | Swell.Account) => {
            if (isAccount(element)) {
                created++;
            } else {
                skipped++;
            }
        });

        Log.event(`${chalk.green("Created")}: ${created}`);
        Log.event(`${chalk.yellow("Skipped")}: ${skipped}`);

        count.created += created;
        count.skipped += skipped;
    }

    return count;
}

function _getAccountObjFromCustomer(this: WooSwell, customer: Woo.Customer): Swell.Account {
    /** set type to company if there is a company name  */
    const type = customer.billing?.company ? "business" : "individual";

    const account: Swell.Account = {
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        name: type === "business" ? customer.billing?.company : undefined,
        phone: customer.billing?.phone,
        type,
        billing: {
            first_name: customer.billing?.first_name,
            last_name: customer.billing?.last_name,
            address1: customer.billing?.address_1,
            company: customer.billing?.company,
            address2: customer.billing?.address_2,
            city: customer.billing?.city,
            state: customer.billing?.state,
            zip: customer.billing?.postcode ? parseInt(customer.billing?.postcode) : undefined,
            country: customer.billing?.country,
            phone: customer.billing?.phone,
        },
        shipping: {
            first_name: customer.shipping?.first_name,
            last_name: customer.shipping?.last_name,
            company: customer.shipping?.company,
            address1: customer.shipping?.address_1,
            address2: customer.shipping?.address_2,
            city: customer.shipping?.city,
            state: customer.shipping?.state,
            zip: customer.shipping?.postcode ? parseInt(customer.shipping.postcode) : undefined,
            country: customer.shipping?.country,
        },
    };

    return account;
}
