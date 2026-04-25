package com.christmaslightmap.repository;

import com.christmaslightmap.model.Host;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HostRepository extends JpaRepository<Host, Long> {
    Optional<Host> findByHandle(String handle);
    boolean existsByHandle(String handle);
    boolean existsByHandleAndIdNot(String handle, Long id);
    List<Host> findByOwner_IdOrderByCreatedAtDesc(Long ownerId);
    List<Host> findByDisplayNameContainingIgnoreCaseOrderByDisplayNameAsc(String query, Pageable pageable);
}
