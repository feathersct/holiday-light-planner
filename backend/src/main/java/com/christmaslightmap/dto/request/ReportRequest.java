package com.christmaslightmap.dto.request;

import com.christmaslightmap.model.ReportReason;
import lombok.Data;

@Data
public class ReportRequest {
    private ReportReason reason;
    private String notes;
}
