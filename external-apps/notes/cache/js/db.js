var DB = new function() {
    var self = this,
        
        indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB,
        IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.mozIDBTransaction,
        
        db = null,
        DB_NAME = "EVME_Notes",
        DB_VERSION = 3,
        
        schema = {
            "notes": {
                "objectName": "Note",
                "indexes": ["notebook_id", "name"]
            },
            "noteResource": {
                "objectName": "NoteResource",
                "indexes": ["note_id"]
            },
            "notebooks": {
                "objectName": "Notebook",
                "indexes": ["user_id"]
            },
            "users": {
                "objectName": "User"
            }
        };
        
    this.init = function(onSuccess) {
        self.open(onSuccess);
        
        // automaticaly create helper methods (like getNotes, or removeNotebook)
        for (var table in schema) {
            var obj = schema[table].objectName;
            
            (function(tableName, objName) {
                self['get' + objName + "s"] = function(filters, c, e) { self.get(tableName, filters, c, e); };
                self['add' + objName] = function(obj, c, e) { self.add(tableName, obj, c, e); };
                self['update' + objName] = function(obj, c, e) { self.update(tableName, obj, c, e); };
                self['remove' + objName] = function(obj, c, e) { self.remove(tableName, obj.getId(), c, e); };
            })(table, obj);
        }
    };
    
    
    this.get = function() { return db; };
    
    // update multiple objects (update @table set data=@data where filters=@filters)
    this.updateMultiple = function(table, filters, data, c, e) {
        self.get(table, filters, function(items) {
            for (var i=0; i<items.length; i++) {
                var item = items[i];
                item.set(data);
            }
            
            c && c();
        });
        
        Console.log("DB update -" + table + "-: ", filters, data);
    };
    
    this.remove = function(table, key, c, e) {
        var store = db.transaction(table, IDBTransaction.READ_WRITE).objectStore(table),
            req = store["delete"](key);
            
        req.onsuccess = function(e) {
            c && c();
        };
        req.onfailure = self.onerror;
        
        Console.log("DB remove from -" + table + "-: ", key);
    };
    
    this.update = function(table, obj, c, e) {
        var transaction = db.transaction(table, IDBTransaction.READ_WRITE);
        
        transaction.oncomplete = function(e) {
            c && c(obj);
        };
        transaction.onfailure = self.onerror;
        
        var request = transaction.objectStore(table).put(serialize(obj));
        request.onsuccess = function(e) {};
        request.onfailure = function(e) {};
        
        Console.log("DB update -" + table + "-: ", obj);
    };
    
    this.get = function(table, filters, c, e) {
        var ret = [],
            req = db.transaction(table).objectStore(table).openCursor();
            
        req.onsuccess = function(e) {
            var cursor = e.target.result;
            if (cursor) {
                var obj = cursor.value,
                    ok = true;
                
                for (var k in filters) {
                    if (obj[k] !== filters[k])  {
                        ok = false;
                        break;
                    }
                }
                
                ok && ret.push(unserialize(obj, table));
                
                cursor["continue"]();
            } else {
                Console.log("DB: get from -" + table + "-: ", filters, ret);
                c && c(ret);
            }
        };
        req.onfailure = self.onerror;
    };
    
    this.add = function(table, obj, c, e) {
        var transaction = db.transaction(table, IDBTransaction.READ_WRITE);
        
        transaction.oncomplete = function(e) {
            c && c(obj);
        };
        transaction.onerror = self.onerror;
        
        var store = transaction.objectStore(table),
            request = store.add(serialize(obj));
        request.onsuccess = function(e) {
        };
        request.onerror = function(e) {
        };
        
        Console.log("DB: add to -" + table + "-: ", obj);
    };
    
    // convert Object to storable data 
    function serialize(obj) {
        var data = {};
        
        for (var key in obj) {
            if (key.indexOf('data_') !== -1) {
                data[key.replace('data_', "")] = obj[key];
            }
        }
        
        return data;
    }
    // given data and table, return an object
    function unserialize(data, table) {
        var objName = schema[table].objectName;
        return new window[objName](data);
    }
    
    
    
    this.destroy = function() {
        var req = indexedDB.deleteDatabase(DB_NAME);
        
        req.onsuccess = function() {
            console.log("Database destroyed.")
        };
        req.onerror = req.onblocked = function(ev) {
            console.log("Database destroy failed: ", ev)
        };
    };
    
    this.open = function(cbSuccess) {
        var request = indexedDB.open(DB_NAME, DB_VERSION);
        Console.log("DB: Opening " + DB_NAME + "(" + DB_VERSION + ")...");
        
        request.onupgradeneeded = function(e) {
            Console.log("DB: Upgrading version...");
            
            var transaction = e.target.transaction;
            
            for (var table in schema) {
                var store = null,
                    indexes = schema[table].indexes || [];
                    
                if (transaction.objectStoreNames && transaction.objectStoreNames.contains(table)) {
                    store = transaction.objectStore(table);
                } else {
                    store = transaction.db.createObjectStore(table, {keyPath: "id"})
                }
                
                var currentIndexes = store.indexNames;
                for (var i=0; i<indexes.length; i++) {
                    if (!currentIndexes.contains(indexes[i])) {
                        store.createIndex(indexes[i], indexes[i], {'unique': false});
                    }
                }
            }
            
            transaction.oncomplete = function() {
                Console.log("DB: Upgrade success!");
            };
            transaction.onfailure = self.onerror;
        };
    
        request.onsuccess = function(e) {
            db = e.target.result;
            
            Console.log("DB: Open success!", db);
            
            cbSuccess && cbSuccess(db);
        };
        
        request.onerror = function(e) {
            self.onerror(e);
        };
        
        request.onblocked = function(e) {
            self.onerror(e);
        };
    };
    
    this.onerror = function(e) {
        Console.error("DB: Error!", e);
    };
};