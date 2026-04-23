package com.christmaslightmap.service;

import com.christmaslightmap.dto.request.UpdateReportRequest;
import com.christmaslightmap.dto.response.DisplaySummaryResponse;
import com.christmaslightmap.dto.response.PagedResponse;
import com.christmaslightmap.dto.response.ReportResponse;
import com.christmaslightmap.dto.response.TagResponse;
import com.christmaslightmap.model.Display;
import com.christmaslightmap.model.DisplayPhoto;
import com.christmaslightmap.model.ReportStatus;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import com.christmaslightmap.repository.DisplayRepository;
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
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {

    private final ReportRepository reportRepository;
    private final DisplayRepository displayRepository;
    private final DisplayPhotoRepository displayPhotoRepository;

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

    public PagedResponse<DisplaySummaryResponse> getAllDisplays(Boolean active, int page, int size) {
        var pageable = PageRequest.of(page, size);
        Page<Display> displays = (active != null)
            ? displayRepository.findByIsActiveOrderByCreatedAtDesc(active, pageable)
            : displayRepository.findAllByOrderByCreatedAtDesc(pageable);

        List<Long> ids = displays.getContent().stream().map(Display::getId).collect(Collectors.toList());
        Map<Long, String> primaryUrls = ids.isEmpty() ? Map.of() :
            displayPhotoRepository.findPrimaryByDisplayIdIn(ids).stream()
                .collect(Collectors.toMap(p -> p.getDisplay().getId(), DisplayPhoto::getUrl));

        List<DisplaySummaryResponse> content = displays.getContent().stream()
            .map(d -> DisplaySummaryResponse.builder()
                .id(d.getId())
                .title(d.getTitle())
                .city(d.getCity())
                .state(d.getState())
                .lat(d.getLocation().getY())
                .lng(d.getLocation().getX())
                .upvoteCount(d.getUpvoteCount())
                .photoCount(d.getPhotoCount())
                .displayType(d.getDisplayType().name())
                .primaryPhotoUrl(primaryUrls.get(d.getId()))
                .tags(d.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
                .isActive(d.isActive())
                .build())
            .collect(Collectors.toList());

        return PagedResponse.<DisplaySummaryResponse>builder()
            .content(content)
            .page(page)
            .size(size)
            .totalElements(displays.getTotalElements())
            .totalPages(displays.getTotalPages())
            .last(displays.isLast())
            .build();
    }

    @Transactional
    public DisplaySummaryResponse setDisplayActive(Long displayId, boolean active) {
        Display display = displayRepository.findById(displayId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Display not found"));
        display.setActive(active);
        Display saved = displayRepository.save(display);
        return DisplaySummaryResponse.builder()
            .id(saved.getId())
            .title(saved.getTitle())
            .city(saved.getCity())
            .state(saved.getState())
            .lat(saved.getLocation().getY())
            .lng(saved.getLocation().getX())
            .upvoteCount(saved.getUpvoteCount())
            .photoCount(saved.getPhotoCount())
            .displayType(saved.getDisplayType().name())
            .isActive(saved.isActive())
            .tags(saved.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
            .build();
    }

    @Transactional
    public void adminDeleteDisplay(Long displayId) {
        Display display = displayRepository.findById(displayId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Display not found"));
        displayRepository.delete(display);
    }
}
