package com.christmaslightmap.dto.response;

import com.christmaslightmap.model.Report;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ReportResponse {
    private Long id;
    private Long displayId;
    private String displayTitle;
    private Long reporterId;
    private String reporterName;
    private String reason;
    private String notes;
    private String status;
    private LocalDateTime createdAt;

    public static ReportResponse from(Report report) {
        return ReportResponse.builder()
            .id(report.getId())
            .displayId(report.getListing().getId())
            .displayTitle(report.getListing().getTitle())
            .reporterId(report.getUser().getId())
            .reporterName(report.getUser().getName())
            .reason(report.getReason().name())
            .notes(report.getNotes())
            .status(report.getStatus().name())
            .createdAt(report.getCreatedAt())
            .build();
    }
}
