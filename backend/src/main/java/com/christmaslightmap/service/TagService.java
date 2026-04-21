package com.christmaslightmap.service;

import com.christmaslightmap.dto.response.TagResponse;
import com.christmaslightmap.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TagService {

    private final TagRepository tagRepository;

    public List<TagResponse> getAll() {
        return tagRepository.findAllByOrderByNameAsc().stream()
            .map(TagResponse::from)
            .collect(Collectors.toList());
    }
}
