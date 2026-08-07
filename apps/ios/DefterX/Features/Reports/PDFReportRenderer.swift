import Foundation
import PDFKit
import UIKit

enum PDFReportRenderer{
 static func render(title:String,lines:[String])->Data{let format=UIGraphicsPDFRendererFormat();let renderer=UIGraphicsPDFRenderer(bounds:CGRect(x:0,y:0,width:595,height:842),format:format);return renderer.pdfData{context in context.beginPage();let titleAttributes:[NSAttributedString.Key:Any]=[.font:UIFont.boldSystemFont(ofSize:22)];title.draw(at:CGPoint(x:40,y:40),withAttributes:titleAttributes);var y:CGFloat=86;for line in lines{if y>790{context.beginPage();y=40};line.draw(at:CGPoint(x:40,y:y),withAttributes:[.font:UIFont.systemFont(ofSize:12)]);y+=20}}}
}

