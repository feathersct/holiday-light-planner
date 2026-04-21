package com.christmaslightmap.service;

import com.christmaslightmap.dto.request.ReportRequest;
import com.christmaslightmap.model.Report;
import com.christmaslightmap.model.ReportStatus;
import com.christmaslightmap.repository.DisplayRepository;
import com.christmaslightmap.repository.ReportRepository;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final DisplayRepository displayRepository;
    private final UserRepository userRepository;

    @Transactional
    public void createReport(Long userId, Long displayId, ReportRequest request) {
        var display = displayRepository.findById(displayId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Display not found"));
        var user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        reportRepository.save(Report.builder()
            .display(display)
            .user(user)
            .reason(request.getReason())
            .notes(request.getNotes())
            .status(ReportStatus.OPEN)
            .build());
    }
}
