import Foundation
import GRDB

final class ReferenceCache:@unchecked Sendable{
 private let database:AppDatabase;private let encoder=JSONEncoder();private let decoder=JSONDecoder()
 init(database:AppDatabase){self.database=database}
 func save<T:Encodable & Identifiable & Sendable>(_ values:[T],kind:String,bookId:UUID?)async throws where T.ID==UUID{try await database.writer.write{db in for value in values{try db.execute(sql:"INSERT INTO reference_cache(kind,id,bookId,payload,updatedAt)VALUES(?,?,?,?,?) ON CONFLICT(kind,id)DO UPDATE SET payload=excluded.payload,updatedAt=excluded.updatedAt",arguments:[kind,value.id.uuidString,bookId?.uuidString ?? "",try encoder.encode(value),Date.now])}}}
 func load<T:Decodable & Sendable>(_ type:T.Type,kind:String,bookId:UUID?)async throws->[T]{try await database.writer.read{db in let rows=try Row.fetchAll(db,sql:"SELECT payload FROM reference_cache WHERE kind=? AND bookId=? ORDER BY updatedAt",arguments:[kind,bookId?.uuidString ?? ""]);return try rows.map{row in let data:Data=row["payload"];return try decoder.decode(T.self,from:data)}}}
}
