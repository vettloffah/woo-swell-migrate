
import WooSwell from "../index";
import getReducedObject from "../utils/getReducedObject.js";
import * as Log from "../utils/Log.js";

import * as Woo from "../types/WooCommerce";
import * as Swell from "../types/Swell";
import { CategoryObject } from "../types/types";

/**
 * Create all categories in Swell that exist in Woo. This will not overwrite or create duplicates if 
 * there is already a category with matching slug property.
 */
export async function createOrUpdateCategories(this: WooSwell) {
    this.wooCategories = await this.getAllPagesWoo("products/categories") as Woo.Category[];
    this.swellCategories = await this.getAllPagesSwell("/categories") as Swell.Category[];
    const swellObj = getReducedObject(this.swellCategories, "slug", "id") as CategoryObject;

    /** Skip if it exists already in swell */
    for (const cat of this.wooCategories) {
        const category: Swell.Category = {
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            active: true,
        };

        if (swellObj[cat.slug]) {
            /** update category */
            await this.swell.put(`/categories/${swellObj[cat.slug]}`, category);
            Log.event(`category ${cat.slug} updated`);
            continue;
        }

        /** create category */
        await this.swell.post("/categories", category);
        Log.event(`category ${cat.slug} created`);
    }
}

/**
* Add child / parent relationships to categories in Swell.
* This should only be executed _after_ all categories have been added to Swell 
* using createOrUpdateCategories()
*/
export async function addCategoryParents(this: WooSwell) {
    const count = { parents: 0 };

    Log.info(`building category lists`);
    if (!this.swellCategories.length) {
        this.swellCategories = await this.getAllPagesSwell("/categories") as Swell.Category[];
        this.wooCategories = await this.getAllPagesWoo("products/categories") as Woo.Category[];
    }

    /** build relational objects */
    const wooIdObj = getReducedObject(this.wooCategories, "id", "slug") as { [slug: string]: string };
    const wooParentObj = getReducedObject(this.wooCategories, "slug", "parent") as { [slug: string]: number };
    const swellSlugObj = getReducedObject(this.swellCategories, "slug", "id") as { [slug: string]: string };

    const parentObj: { [slug: string]: string } = {};

    /** build relational object for any categories that contain have a parent category */
    for (const [slug, parentId] of Object.entries(wooParentObj)) {
        /** if there's a parent ID listed in woo AND there is actually a category with that ID */
        if (parentId && swellSlugObj[wooIdObj[parentId]]) {
            parentObj[slug] = swellSlugObj[wooIdObj[parentId]];
        }
    }

    Log.info(`adding parents to categories`);

    /** update category with parent */
    for (const [slug, id] of Object.entries(parentObj)) {
        await this.swell.put(`categories/${swellSlugObj[slug]}`, { parent_id: id });
        Log.event(`parent added to ${slug}`);
        count.parents++;
    }

    return count;
}

/**
 * Delete categories that exist in swell but not in woocommerce. 
 * (useful for clearing out initial demo categories)
 */
export async function deleteUnmatchedCategories(this: WooSwell): Promise<{ deleted: number }> {
    Log.info(`deleting categories that don't match woocommerce`);

    let deleted = 0;

    if (!this.wooCategories.length) {
        this.wooCategories = await this.getAllPagesWoo("products/categories") as Woo.Category[];
        this.swellCategories = await this.getAllPagesSwell("/categories") as Swell.Category[];
    }

    const wooCatSlugs = this.wooCategories.map(cat => {
        return cat.slug;
    });

    const swellObj = getReducedObject(this.swellCategories, "slug", "id") as { [slug: string]: string };

    for (const slug of Object.keys(swellObj)) {
        /** don't delete the category if the name exists in woocommerce */
        if (wooCatSlugs.includes(slug)) {
            continue;
        }
        await this.swell.delete(`/categories/${swellObj[slug]}`);
        Log.event(`category ${slug} deleted`);
        deleted++;
    }

    Log.info(`${deleted} categories deleted`);
    return { deleted };
}
