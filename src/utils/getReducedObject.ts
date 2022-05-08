/**
 * 
 * @param arr - array of objects to reduce into a key: value pair object (associative array)
 * @param key - which property you want to use as the key in the new associative array
 * @param value - which property you want to use as the value in the new associative array
 * 
 * @returns - { key: value, key: value } object
 */
export default function getReducedObject(arr: Array<AnyObject>, key: string, value: string){

    const initialValue = { [arr[0][key]] : arr[0][value] };

    return arr.reduce((acc: AnyObject, curr: AnyObject, index: number) => {

        return {...acc, [curr[key]]: curr[value]}
        
    }, initialValue ) as AnyObject

}

export type AnyObject = {
    [key: string]: any;
}