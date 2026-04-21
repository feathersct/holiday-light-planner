package com.christmaslightmap.dto.request;

import com.christmaslightmap.model.ReportStatus;
import lombok.Data;

@Data
public class UpdateReportRequest {
    private ReportStatus status;
}
