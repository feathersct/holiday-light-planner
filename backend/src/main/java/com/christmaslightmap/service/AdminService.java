package com.christmaslightmap.service;

import com.christmaslightmap.dto.request.UpdateReportRequest;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.ReportResponse;
import com.christmaslightmap.model.ReportStatus;
import com.christmaslightmap.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {

    private final ReportRepository reportRepository;

    public PagedResponse<ReportResponse> getReports(ReportStatus status, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<com.christmaslightmap.model.Report> reports = (status != null)
            ? reportRepository.findByStatus(status, pageable)
            : reportRepository.findAll(pageable);

        List<ReportResponse> content = reports.getContent().stream()
            .map(ReportResponse::from)
            .collect(Collectors.toList());

        return PagedResponse.<ReportResponse>builder()
            .content(content)
            .page(page)
            .size(size)
            .totalElements(reports.getTotalElements())
            .totalPages(reports.getTotalPages())
            .last(reports.isLast())
            .build();
    }

    @Transactional
    public ReportResponse updateReport(Long reportId, UpdateReportRequest request) {
        var report = reportRepository.findById(reportId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));
        report.setStatus(request.getStatus());
        return ReportResponse.from(reportRepository.save(report));
    }
}
