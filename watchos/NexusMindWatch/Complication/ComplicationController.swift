import SwiftUI
import ClockKit

class ComplicationController: NSObject, CLKComplicationDataSource {

    // MARK: - Timeline Entry

    func getCurrentTimelineEntry(
        for complication: CLKComplication,
        withHandler handler: @escaping (CLKComplicationTimelineEntry?) -> Void
    ) {
        let template = createTemplate(for: complication)
        let entry = CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template)
        handler(entry)
    }

    // MARK: - Template Creation

    private func createTemplate(for complication: CLKComplication) -> CLKComplicationTemplate {
        // 获取当前状态 (从 UserDefaults 或缓存)
        let status = UserDefaults.standard.string(forKey: "sentinelStatus") ?? "unknown"
        let healthScore = UserDefaults.standard.double(forKey: "healthScore")

        switch complication.family {
        case .modularSmall:
            let template = CLKComplicationTemplateModularSmallStackImage()
            template.line1ImageProvider = CLKImageProvider(onePieceImage: statusImage(status))
            template.line2TextProvider = CLKSimpleTextProvider(text: statusText(status))
            return template

        case .circularSmall:
            let template = CLKComplicationTemplateCircularSmallRingImage()
            template.imageProvider = CLKImageProvider(onePieceImage: statusImage(status))
            template.fillFraction = Float(healthScore)
            template.ringStyle = .closed
            return template

        case .graphicCircular:
            let template = CLKComplicationTemplateGraphicCircularOpenRingImage()
            template.imageProvider = CLKImageProvider(onePieceImage: statusImage(status))
            template.ring.fillFraction = Float(healthScore)
            return template

        case .graphicCorner:
            let template = CLKComplicationTemplateGraphicCornerGaugeImage()
            template.imageProvider = CLKImageProvider(onePieceImage: statusImage(status))
            template.gaugeProvider = CLKSimpleGaugeProvider(
                style: .fill,
                gaugeColor: gaugeColor(status),
                fillFraction: Float(healthScore)
            )
            return template

        default:
            // 默认返回简单的文本模板
            let template = CLKComplicationTemplateModularSmallStackText()
            template.line1TextProvider = CLKSimpleTextProvider(text: "NM")
            template.line2TextProvider = CLKSimpleTextProvider(text: statusText(status))
            return template
        }
    }

    // MARK: - Helpers

    private func statusImage(_ status: String) -> UIImage {
        let systemName: String
        switch status {
        case "healthy": systemName = "checkmark.shield.fill"
        case "degraded": systemName = "exclamationmark.shield.fill"
        case "dead": systemName = "xmark.shield.fill"
        default: systemName = "questionmark.shield"
        }
        return UIImage(systemName: systemName) ?? UIImage()
    }

    private func statusText(_ status: String) -> String {
        switch status {
        case "healthy": return "OK"
        case "degraded": return "WARN"
        case "dead": return "ERR"
        default: return "?"
        }
    }

    private func gaugeColor(_ status: String) -> UIColor {
        switch status {
        case "healthy": return .systemGreen
        case "degraded": return .systemOrange
        case "dead": return .systemRed
        default: return .systemGray
        }
    }

    // MARK: - Timeline Schedule

    func getTimelineEntries(
        for complication: CLKComplication,
        after date: Date,
        limit: Int,
        withHandler handler: @escaping ([CLKComplicationTimelineEntry]?) -> Void
    ) {
        // 不提供未来时间线，使用实时更新
        handler(nil)
    }

    func getNextRequestedUpdateDate(
        withHandler handler: @escaping (Date?) -> Void
    ) {
        // 每15分钟请求更新
        handler(Date(timeIntervalSinceNow: 15 * 60))
    }
}