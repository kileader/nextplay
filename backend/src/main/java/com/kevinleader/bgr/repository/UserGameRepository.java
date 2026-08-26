package com.kevinleader.bgr.repository;

import com.kevinleader.bgr.entity.AppUser;
import com.kevinleader.bgr.entity.UserGame;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserGameRepository extends JpaRepository<UserGame, Long> {

    List<UserGame> findByUser(AppUser user);

    @Query("SELECT ug FROM UserGame ug LEFT JOIN FETCH ug.gameCache WHERE ug.user = :user")
    List<UserGame> findLibraryByUser(@Param("user") AppUser user);

    Optional<UserGame> findByUserAndSteamAppId(AppUser user, Integer steamAppId);
}
