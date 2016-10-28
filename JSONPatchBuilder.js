/**
 * Created by eric on 05/10/16.
 */
define(["require", "exports"], function (require, exports) {
    "use strict";
    function checkForAdd(results, fromSet, toSet, path, doingAdd) {
        for (var key in toSet) {
            var subpath = path + "/" + key;
            if (!fromSet.hasOwnProperty(key)) {
                if (doingAdd) {
                    results.push({ op: "add", path: subpath, value: toSet[key] });
                }
                else {
                    results.push({ op: "remove", path: subpath });
                }
            }
            else if (typeof toSet[key] === "object") {
                checkForAdd(results, fromSet[key], toSet[key], subpath, doingAdd);
            }
        }
    }
    function checkForReplaceItem(results, fromObj, toObj, path) {
        if (typeof fromObj !== typeof toObj) {
            results.push({ op: "replace", path: path, value: toObj });
        }
        else if (typeof toObj == "object") {
            if (typeof toObj.length != typeof fromObj.length) {
                // handle the object versus array case
                results.push({ op: "replace", path: path, value: toObj });
            }
            else {
                checkForReplace(results, fromObj, toObj, path);
            }
        }
        else if (toObj !== fromObj) {
            results.push({ op: "replace", path: path, value: toObj });
        }
    }
    function checkForReplace(results, fromSet, toSet, path) {
        for (var key in toSet) {
            var subpath = path + "/" + key;
            if (fromSet.hasOwnProperty(key)) {
                checkForReplaceItem(results, fromSet[key], toSet[key], subpath);
            }
        }
    }
    /**
     * This method assumes that oldData and newData are both objects (or arrays)
     * @param oldData
     * @param newData
     * @returns {JSONPatchData}
     * @constructor
     */
    function JSONPatchBuilder(oldData, newData) {
        var items = [];
        if (typeof oldData === "object" && typeof newData === "object") {
            checkForAdd(items, oldData, newData, "", true);
            checkForAdd(items, newData, oldData, "", false);
        }
        checkForReplaceItem(items, oldData, newData, "");
        return items;
    }
    exports.JSONPatchBuilder = JSONPatchBuilder;
});
