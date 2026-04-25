package com.christmaslightmap.service;

import com.christmaslightmap.dto.request.CreateHostRequest;
import com.christmaslightmap.dto.request.TransferHostRequest;
import com.christmaslightmap.dto.request.UpdateHostRequest;
import com.christmaslightmap.dto.response.HostResponse;
import com.christmaslightmap.model.Host;
import com.christmaslightmap.model.User;
import com.christmaslightmap.repository.HostRepository;
import com.christmaslightmap.repository.ListingRepository;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HostService {

    private final HostRepository hostRepository;
    private final UserRepository userRepository;
    private final ListingRepository listingRepository;
    private final S3Client s3Client;

    @Value("${app.r2.bucket}")
    private String bucket;

    @Value("${app.r2.public-url}")
    private String publicUrl;

    @Transactional
    public HostResponse createHost(Long userId, CreateHostRequest request) {
        User owner = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (hostRepository.existsByHandle(request.getHandle())
                || userRepository.existsByHandle(request.getHandle())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Handle already taken");
        }

        Host host = hostRepository.save(Host.builder()
            .owner(owner)
            .handle(request.getHandle())
            .displayName(request.getDisplayName())
            .build());

        return toResponse(host);
    }

    public List<HostResponse> searchHosts(String q) {
        return hostRepository.findByDisplayNameContainingIgnoreCaseOrderByDisplayNameAsc(q, PageRequest.of(0, 10))
            .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<HostResponse> getMyHosts(Long userId) {
        return hostRepository.findByOwner_IdOrderByCreatedAtDesc(userId).stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    @Transactional
    public HostResponse updateHost(Long userId, Long hostId, UpdateHostRequest request) {
        Host host = findOwned(userId, hostId);

        if (request.getHandle() != null) {
            if (hostRepository.existsByHandleAndIdNot(request.getHandle(), hostId)
                    || userRepository.existsByHandle(request.getHandle())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Handle already taken");
            }
            host.setHandle(request.getHandle());
        }

        if (request.getDisplayName() != null) {
            host.setDisplayName(request.getDisplayName());
        }

        return toResponse(hostRepository.save(host));
    }

    @Transactional
    public void deleteHost(Long userId, Long hostId) {
        Host host = findOwned(userId, hostId);

        if (listingRepository.existsByHostIdAndIsActiveTrue(hostId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Remove all active listings before deleting");
        }

        hostRepository.delete(host);
    }

    @Transactional
    public void transferHost(Long userId, Long hostId, TransferHostRequest request) {
        Host host = findOwned(userId, hostId);

        User target = userRepository.findByHandle(request.getTargetHandle())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No user found with that handle"));

        if (target.getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You already own this host");
        }

        host.setOwner(target);
        hostRepository.save(host);
    }

    @Transactional
    public HostResponse uploadAvatar(Long userId, Long hostId, MultipartFile file) {
        Host host = findOwned(userId, hostId);

        String extension = getExtension(file.getOriginalFilename());
        String key = "hosts/" + hostId + "/avatar" + extension;

        try {
            s3Client.putObject(
                PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(file.getContentType())
                    .build(),
                RequestBody.fromBytes(file.getBytes())
            );
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "File upload failed");
        }

        host.setAvatarUrl(publicUrl + "/" + key);
        return toResponse(hostRepository.save(host));
    }

    private Host findOwned(Long userId, Long hostId) {
        Host host = hostRepository.findById(hostId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found"));
        if (!host.getOwner().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your host");
        }
        return host;
    }

    private HostResponse toResponse(Host host) {
        return HostResponse.builder()
            .id(host.getId())
            .handle(host.getHandle())
            .displayName(host.getDisplayName())
            .avatarUrl(host.getAvatarUrl())
            .listingCount(listingRepository.countByHostIdAndIsActiveTrue(host.getId()))
            .createdAt(host.getCreatedAt())
            .build();
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf("."));
    }
}
